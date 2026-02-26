import re
import os
import sys
import json
import argparse
import logging

from formatter import CustomFormatter
from aws import client, deploy_client, batch_client, autoscaling_client
from ssm import get_vars_from_ssm
from helpers import apply_fluent_bit, prepare_fluentbit_config, apply_opentelemetry_config
from batch import get_latest_batch_revision

ECS_CPU_TO_VCPU = {
    256: "0.25",
    512: "0.5",
    1024: "1",
    2048: "2",
    4096: "4",
    8192: "8",
    16384: "16"
}

port_range=range(40000, 40101)

### Colored logging
logger = logging.getLogger("Deployment")
logger.setLevel(logging.DEBUG)

ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)

ch.setFormatter(CustomFormatter())

logger.addHandler(ch)

### Arg parser
parser = argparse.ArgumentParser(description='traderlion deployment script for nodejs apps')
parser.add_argument('--cluster', type=str, help='ECS cluster')

parser.add_argument('--service', type=str, help='Service name')
parser.add_argument('--family', type=str, help='Task definition family')
parser.add_argument('--port', type=str, help='Task definition container port')
parser.add_argument('--deployment', type=str, help='Code deploy app name')
parser.add_argument('--deploymentgroup', type=str, help='Code Deploy deployment group')
parser.add_argument('--memory', type=str, help='ECS definition RAM')
parser.add_argument('--capacityprovider', type=str, help='ECS capacityprovider name for cluster')
parser.add_argument('--contanername', type=str, help='ECS task definition container name')
parser.add_argument('--verbose', type=str, help='verbose', default=False)
parser.add_argument('--cpu', type=str, help='Task cpu', default=False)
parser.add_argument('--environment',
                    type=str, help='Environemnt name: for example staging or production')
parser.add_argument('--servicenames',
                    type=lambda s: re.split(' |, ', s), help='List of service for ssm ')
parser.add_argument('--onlybatch', type=int, help='Deploy only batch')
parser.add_argument('--markettype', type=str, help='Market type')
parser.add_argument('--fargate', help='Enable fargate', action='store_true', default=False)
parser.add_argument('--fluentimage', type=str, help='Custom fluent bit image', default='')
parser.add_argument('--desired_count', type=int, help='Service desired count', default=1)
parser.add_argument('--disable_ssm_management', type=int, help='Disable SSM management. Disables adding SSM variables to the ECS task definition also removes.', default=0)

parser.add_argument('--enable_autoscaling', action='store_true', help='Enable autoscaling', default=False)
parser.add_argument('--min_capacity', type=int, help='Minimum tasks', default=1)
parser.add_argument('--max_capacity', type=int, help='Maximum tasks', default=5)
parser.add_argument('--target_cpu', type=int, help='Target CPU %', default=0)
parser.add_argument('--target_memory', type=int, help='Target Memory %', default=0)

args = parser.parse_args()

if args.port is None or args.family is None or args.service is None \
    or args.cluster is None or args.memory is None or args.port is None\
    or args.capacityprovider is None or args.contanername is None\
    or args.environment is None or args.servicenames is None:
    logger.critical('Specify all of args:\
                    --cluster, --service, --family, --port, --memory, \
                    --capacityprovider, --contanername, --environment, --servicenames')
    sys.exit(0)

logger.info(f'Fagate enabled: {args.fargate}')

def setup_autoscaling(cluster, service, min_cap, max_cap, target_cpu, target_mem):
    logger.info(f"Configuring Autoscaling for {service}...")
    resource_id = f"service/{cluster}/{service}"

    try:
        autoscaling_client.register_scalable_target(
            ServiceNamespace='ecs',
            ResourceId=resource_id,
            ScalableDimension='ecs:service:DesiredCount',
            MinCapacity=min_cap,
            MaxCapacity=max_cap
        )
        
        if target_cpu > 0:
            autoscaling_client.put_scaling_policy(
                PolicyName=f"{service}-cpu-scaling",
                ServiceNamespace='ecs',
                ResourceId=resource_id,
                ScalableDimension='ecs:service:DesiredCount',
                PolicyType='TargetTrackingScaling',
                TargetTrackingScalingPolicyConfiguration={
                    'TargetValue': target_cpu,
                    'PredefinedMetricSpecification': {
                        'PredefinedMetricType': 'ECSServiceAverageCPUUtilization'
                    },
                    'ScaleOutCooldown': 60,
                    'ScaleInCooldown': 60
                }
            )
            logger.info(f"Autoscaling: CPU target set to {target_cpu}%")

        if target_mem > 0:
            autoscaling_client.put_scaling_policy(
                PolicyName=f"{service}-memory-scaling",
                ServiceNamespace='ecs',
                ResourceId=resource_id,
                ScalableDimension='ecs:service:DesiredCount',
                PolicyType='TargetTrackingScaling',
                TargetTrackingScalingPolicyConfiguration={
                    'TargetValue': target_mem,
                    'PredefinedMetricSpecification': {
                        'PredefinedMetricType': 'ECSServiceAverageMemoryUtilization'
                    },
                    'ScaleOutCooldown': 60,
                    'ScaleInCooldown': 60
                }
            )
            logger.info(f"Autoscaling: Memory target set to {target_mem}%")
            
    except Exception as e:
        logger.error(f"Failed to configure autoscaling: {str(e)}")

portMappings = []

###  Add port mapping for the application port
portMappings.append({
    "hostPort": 0 if not args.fargate else int(args.port),
    "protocol": "tcp",
    "containerPort": int(args.port)
})

### Add custom dynamic ports
for port in port_range:
    portMappings.append({
        "hostPort": 0 if not args.fargate else int(port),
        "protocol": "tcp",
        "containerPort": int(port)
    })

### Get latest task revision using family arg
tasks = client.list_task_definitions(
    familyPrefix=args.family,
    maxResults=1,
    sort="DESC"
)
latest_revision_arn = tasks['taskDefinitionArns'][-1]

### MAKING NEW REVISION ###
new_definition = client.describe_task_definition(
    taskDefinition=latest_revision_arn,
    include=[
        'TAGS',
    ]
)

batch_image = new_definition['taskDefinition']['containerDefinitions'][0]['image']
secrets = get_vars_from_ssm(args.environment, args.servicenames)
if args.verbose:
    logger.debug('------------------- Current vars -------------------')
    for var in secrets:
        logger.debug(var)
    logger.debug('------------------- END Current vars -------------------')

## Remove 
if not args.disable_ssm_management:
    new_definition['taskDefinition']['containerDefinitions'][0]['secrets'] = secrets
else:
    new_definition['taskDefinition']['containerDefinitions'][0]['secrets'] = []

### Not privileged if fargate. Required
new_definition['taskDefinition']['containerDefinitions'][0]['portMappings'] = portMappings
if args.fargate:
    new_definition['taskDefinition']['containerDefinitions'][0]['privileged'] = False
elif args.onlybatch:
    new_definition['taskDefinition']['containerDefinitions'][0]['portMappings'] = []

### pass markettype
if args.markettype:
    new_definition['taskDefinition']['containerDefinitions'][0]['environment'] = [
        {
             "name": "MARKETS",
             "value": args.markettype
        }
    ]

### Update image
new_definition['taskDefinition']['containerDefinitions'][0]['image'] = os.environ.get('production_image')
### Set container name
new_definition['taskDefinition']['containerDefinitions'][0]['name'] = args.contanername
### Update batch image
batch_image = os.environ.get('production_image')


### Batch update/deploy
if args.service == 'crawler' and args.onlybatch == 1:
    logger.info(f"Creating new batch revision for {args.family}")
    latest_revision_batch = get_latest_batch_revision(batch_client, args.family)
    if args.verbose:
        logger.debug("----------------")
        logger.debug(json.dumps(latest_revision_batch, indent=4))
        logger.debug("----------------")
    latest_revision_batch['containerProperties']['secrets'] = secrets
    latest_revision_batch['containerProperties']['image'] = batch_image

    latest_revision_batch['containerProperties']['resourceRequirements'] = [
        {
            "value": ECS_CPU_TO_VCPU[int(args.cpu)],
            "type": "VCPU"
        },
        {
            "value": args.memory,
            "type": "MEMORY"
        }
    ]

    definition = {
        'jobDefinitionName': args.family,
        'type': 'container',
        'containerProperties': latest_revision_batch['containerProperties'],
        'platformCapabilities': ["FARGATE"]
    }
    
    batch_client.register_job_definition(
        jobDefinitionName=args.family,
        type='container',
        containerProperties=latest_revision_batch['containerProperties'],
        platformCapabilities=["FARGATE"]
    )

### Non batch deploy
if args.onlybatch == 0:
    logger.info(f"ALLOCATED MEMORY FOR TASK : {args.memory}MB")
    logger.info(f'Registering new task definition for task family: {args.family}')
    
    # -------------------------------------------------------------
    # LOGIC FIX: Check environment to skip sidecars in DEV
    # -------------------------------------------------------------
    if args.environment.lower() != 'dev':
        logger.info("Applying fluent bit configuration")

        index_name = args.contanername
        ## Add AWS region name for lightservers(used in the Opensearch)
        if 'lightserver' in args.service:
            index_name = f"{index_name}-{os.environ.get('AWS_DEFAULT_REGION')}"
        if 'crawler-realtime' in args.service:
            index_name = f'crawler-realtime-{args.environment.lower()}'
        
        bucket_name = f"{args.environment.lower()}-traderlion-logging-configs"
        logger.info(f"Using logging config bucket: {bucket_name}")
        
        fluent_bit_config_location = prepare_fluentbit_config(
            os.environ.get('ES_HOST', ''), 
            args.contanername, 
            logger, 
            index_name,
            bucket_name
        )
        
        ### Apply fluentbit configuration for logging
        new_definition = apply_fluent_bit(
            args.environment.lower(),
            args.service,
            new_definition,
            fluent_bit_config_location,
            logger,
            args.contanername,
            custom_image=None if not args.fluentimage else args.fluentimage
        )

        logger.info('Applying opentelemetry config')
        new_definition = apply_opentelemetry_config(
            args.environment.lower(),
            args.service,
            new_definition,
            logger,
            args.contanername
        )
    else:
        logger.info("Skipping Sidecars (FluentBit/OpenTelemetry) for DEV environment")
    # -------------------------------------------------------------

    ### Task definition registration
    if args.fargate:
        logger.info('Enabling fargate')
        new_definition['taskDefinition']['requiresCompatibilities'] = ['FARGATE']
        new_definition['taskDefinition']['networkMode'] = 'awsvpc'
        ### Cleanup compatibilities from previous EC2 revision
        if 'compatibilities' in new_definition['taskDefinition']:
            del new_definition['taskDefinition']['compatibilities']
        logger.info('Fargate enabled')
    else:
        logger.info('Disabling/skipping fargate')
        new_definition['taskDefinition']['requiresCompatibilities'] = ['EC2']
        new_definition['taskDefinition']['networkMode'] = 'bridge'
        if 'compatibilities' not in new_definition['taskDefinition']:
            new_definition['taskDefinition']['compatibilities'] = ['EC2']
        logger.info('Disabling/skipping fargate finish')

    if args.fargate:

        definition_args = {
            'family': args.family,
            'taskRoleArn': new_definition['taskDefinition']['taskRoleArn'],
            'executionRoleArn': new_definition['taskDefinition']['executionRoleArn'],
            'networkMode': 'bridge' if not args.fargate else 'awsvpc',
            'memory': args.memory,
            'containerDefinitions' : new_definition['taskDefinition']['containerDefinitions'],
            'requiresCompatibilities' : ['EC2'] if not args.fargate else ['FARGATE'],
            'runtimePlatform' : {
                'cpuArchitecture': 'ARM64',
                'operatingSystemFamily': 'LINUX'
            },
            'volumes' : [{ 'name': 'logs' }]
        }

        if args.cpu:
            definition_args['cpu'] = args.cpu
        task_definition = client.register_task_definition(**definition_args)
    else:
        for i in range(0, len(new_definition['taskDefinition']['containerDefinitions'])):
            new_definition['taskDefinition']['containerDefinitions'][i]['mountPoints'] = [{
                "sourceVolume": "logs",
                "containerPath": "/var/www/app/tmp/traderlionApp/"
            }]

        definition_args = {
            'family' :args.family,
            'executionRoleArn' : new_definition['taskDefinition']['executionRoleArn'],
            'networkMode': 'bridge' if not args.fargate else 'awsvpc',
            'memory': args.memory,
            'containerDefinitions': new_definition['taskDefinition']['containerDefinitions'],
            'requiresCompatibilities': ['EC2'] if not args.fargate else ['FARGATE'],
            'volumes': [{ 'name': 'logs' }]
        }
        if args.cpu:
            definition_args['cpu'] = args.cpu
        task_definition = client.register_task_definition(**definition_args)

    latest_revision_arn = task_definition['taskDefinition']['taskDefinitionArn']

    if args.verbose:
        logger.debug(f"New task definition json: {latest_revision_arn}")

    logger.info(f"Running deployment")
    #### Deployment

    ### Run CodeDeploy if needed
    if args.deployment is None and args.deploymentgroup is None:
        ## Manual stop and run if this is crawler rt or repeater
        if 'crawler-realtime' in args.cluster or 'repeater' in args.cluster:
            waiter = client.get_waiter('services_stable')
            client.update_service(
                cluster=args.cluster,
                service=args.service,
                desiredCount=0,
                taskDefinition=latest_revision_arn
            )
            paginator = client.get_paginator('list_tasks')
            response_iterator = paginator.paginate(
                cluster=args.cluster,
                serviceName=args.service,
                PaginationConfig={
                    'PageSize':100
                }
            )
            for each_page in response_iterator:
                for each_task in each_page['taskArns']:
                    client.stop_task(
                        cluster=args.cluster,
                        task=each_task
                    )
            client.update_service(
                cluster=args.cluster,
                service=args.service,
                desiredCount=args.desired_count,
                taskDefinition=latest_revision_arn
            )
        else:
            client.update_service(
                cluster=args.cluster,
                service=args.service,
                desiredCount=args.desired_count,
                taskDefinition=latest_revision_arn
            )
    else:
        ## Code deploy type of deployment(blue/green)
        app_spec = {
            'version': 0.0,
            'Resources': [{
                'TargetService': {
                    'Type' : 'AWS::ECS::Service',
                    'Properties' : {
                        'TaskDefinition': latest_revision_arn,
                        'LoadBalancerInfo' : {
                            'ContainerName': args.contanername,
                            'ContainerPort': args.port
                        },
                        'CapacityProviderStrategy': [{
                            'CapacityProvider': args.capacityprovider,
                            'Base': 0,
                            'Weight': 1
                        }]
                    }
                }
            }]
        }

        # Add BeforeTrafficHook dynamically for lightserver
        if args.service == "lightserver":
            hook_function_name = f"health-check-{args.environment.lower()}-{args.service}"
            app_spec["Hooks"] = [{
                "BeforeAllowTraffic": hook_function_name
            }]

        deploy_client.create_deployment(
            applicationName=args.deployment,
            deploymentGroupName=args.deploymentgroup,
            revision={
                'revisionType': 'AppSpecContent',
                'appSpecContent': {
                    'content': json.dumps(app_spec)
                },
            },
            description='Deploying updates',
            ignoreApplicationStopFailures=False,
        )
        
    if args.enable_autoscaling:
        setup_autoscaling(
            cluster=args.cluster,
            service=args.service,
            min_cap=args.min_capacity,
            max_cap=args.max_capacity,
            target_cpu=args.target_cpu,
            target_mem=args.target_memory
        )