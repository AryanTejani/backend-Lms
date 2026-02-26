import json
import os
import boto3

def prepare_fluentbit_config(es_host, containername, logger, index_name, bucket_name, upload_s3=True):
    config = f"""
[SERVICE]
    Log_Level info
[OUTPUT]
    Name null
    Match firelens-healthcheck
[OUTPUT]
    Name opensearch
    Match {containername}-firelens*
    Aws_Auth On
    Aws_Region us-east-2
    Host {es_host}
    Index {index_name}
    Port 443
    Suppress_Type_Name On
    retry_limit 2
    Generate_ID On
    tls On
[OUTPUT]
    Name                cloudwatch
    Match               {containername}-firelens*
    region              us-east-2
    log_group_name      {containername}
    log_stream_name     {containername}
    log_retention_days  3
    log_key             log
    auto_retry_requests On
    workers             1
    Retry_Limit         20
    net.keepalive       off
    auto_create_group   true""".lstrip("\n").rstrip("\n").rstrip("\n")

    config = f"""
[INPUT]
    name    tail
    Tag     {containername}-firelens*
    Mem_Buf_Limit         50MB
    Buffer_Chunk_Size     1M
    Buffer_Max_Size       5M
    Refresh_Interval      5
    Rotate_Wait           30
    DB                    /var/log/flb-tail.db
    Skip_Long_Lines       Off
    path    /var/www/app/tmp/traderlionApp/*.log
""".lstrip("\n") + config

    s3_client = boto3.client('s3', region_name='us-east-2')
    output_path = '/tmp/output'

    try:
        with open(output_path, 'w') as f:
            f.write(config)
        file_path = f'{containername}/logDestinations.conf'
        s3_file_path = f'arn:aws:s3:::{bucket_name}/{file_path}'
        if upload_s3:
            s3_client.upload_file(output_path, bucket_name, file_path)
            return s3_file_path
        else:
            return config
    except Exception as e:
        try:
            logger.info('Got an error while uploading fluent bit configs into the s3: ')
            logger.error(e)
        except Exception as etwo:
            print(etwo)
        return False

def apply_opentelemetry_config(environment_name, service_name, definition, logger, containername):
    """

    Args:
        service_name (str): ECS service name
        definition (dict): ECS task definition(previous revision)
        environment_name (str): Environment name. Used to use prefixes for logs.
        fluentbit_config_location (str): S3 url for firelents/fluentbit configuration

    Returns:
        dict: New ecs revision with logging container included.
    """
    service_filter = (
        'api',
        'alerts',
        'adminapi',
        'lightserver',
        'web',
        'lightserver_pre_market',
        'lightserver_post_market',
        'lightserver_pre_regular_post_market',
        'lightserver_pre_regular_market',
        'crawler',
        'crawler-realtime-pre-regular-post-market',
        'repeater',
    )

    container_definitions = definition['taskDefinition']['containerDefinitions']
    dir_path = os.path.dirname(os.path.realpath(__file__))

    logger.info(f'Service name: {service_name}')
    logger.info(f'Service filter: {service_filter}')

    if any(s in service_name for s in service_filter):
        logger.info('Filter passed')
        container_definitions[0]['name'] = containername
        logger.info(f'Found {len(container_definitions)} containers')

        collector_exist = False

        for item in container_definitions:
            if item['name'] == 'aws-otel-collector':
                collector_exist = True
        ## Applying open telemetry collector for managed prometheus
        if not collector_exist:
            logger.info(f'Applying open telemetry configuration for service {service_name} in {environment_name} environment')
            with open(f'{dir_path}/open_telemetry_collector.json', 'r') as log_definition:
                telemetry_collector = json.loads(log_definition.read())
            container_definitions.append(telemetry_collector)
            definition['taskDefinition']['containerDefinitions'] = container_definitions
        else:
            # for item in definition['taskDefinition']['containerDefinitions'][-1]:
            #     definition['taskDefinition']['containerDefinitions'][-1] =
            logger.info('Found open telemetry container. Skipping.')
    return definition

def apply_fluent_bit(environment_name, service_name, definition, fluentbit_config_location, logger, containername, custom_image=None):
    """

    Args:
        service_name (str): ECS service name
        definition (dict): ECS task definition(previous revision)
        environment_name (str): Environment name. Used to use prefixes for logs.
        fluentbit_config_location (str): S3 url for firelents/fluentbit configuration

    Returns:
        dict: New ecs revision with logging container included.
    """
    service_filter = (
        'api',
        'alerts',
        'adminapi',
        'lightserver',
        'web',
        'crawler',
        'crawler-realtime-pre-regular-post-market',
        'repeater',
    )

    container_definitions = definition['taskDefinition']['containerDefinitions']
    dir_path = os.path.dirname(os.path.realpath(__file__))

    logger.info(f'Service name: {service_name}')
    logger.info(f'Service filter: {service_filter}')

    ## If passed filter
    if any(s in service_name for s in service_filter):
        logger.info('Filter passed')
        container_definitions[0]['name'] = containername
        logger.info(f'Found {len(container_definitions)} containers')
        
        # FIX: Relaxed logic to ensure single containers ALWAYS get sidecar injected
        if len(container_definitions) == 1:
            logger.info(f'Applying new logging configuration for service {service_name} in {environment_name} environment')
            with open(f'{dir_path}/log_router.json', 'r') as log_definition:
                log_router = json.loads(log_definition.read())
            
            if custom_image:
                log_router['image'] = custom_image
                log_router['firelensConfiguration']['options'] = {
                    "config-file-type": "file",
                    "config-file-value": "/extra.conf"
                }
            else:
                log_router['firelensConfiguration']['options'] = {
                    "config-file-type": "s3",
                    "config-file-value": fluentbit_config_location
                }

            container_definitions[0]['name'] = containername
            
            # FIX: Safety check if logConfiguration doesn't exist
            if 'logConfiguration' not in container_definitions[0]:
                container_definitions[0]['logConfiguration'] = {}
            
            container_definitions[0]['logConfiguration']['logDriver'] = 'awsfirelens'
            container_definitions[0]['logConfiguration']['options'] = {}
            container_definitions.append(log_router)
            
        elif len(container_definitions) > 1 and container_definitions[0].get('logConfiguration', {}).get('logDriver') == "awsfirelens":
            logger.info("apply_fluent_bit: found two containers. Updating firelens configuration...")
            with open(f'{dir_path}/log_router.json', 'r') as log_definition:
                log_router = json.loads(log_definition.read())
            
            ## Update logging config if it's needed
            container_definitions[0]['name'] = containername
            container_definitions[0]['dependsOn'] = [{
                'containerName': 'log_router',
                'condition': 'START'
            }]
            
            # FIX: Safety check
            if 'logConfiguration' not in container_definitions[0]:
                container_definitions[0]['logConfiguration'] = {}
            container_definitions[0]['logConfiguration']['options'] = {}
            
            if custom_image:
                container_definitions[1]['image'] = custom_image
                if 'firelensConfiguration' not in container_definitions[1]:
                     container_definitions[1]['firelensConfiguration'] = {}
                container_definitions[1]['firelensConfiguration']['options'] = {
                    "config-file-type": "file",
                    "config-file-value": "/extra.conf"
                }
            else:
                if 'firelensConfiguration' not in container_definitions[1]:
                     container_definitions[1]['firelensConfiguration'] = {}
                container_definitions[1]['firelensConfiguration']['options'] = {
                    "config-file-type": "s3",
                    "config-file-value": fluentbit_config_location
                }
        definition['taskDefinition']['containerDefinitions'] = container_definitions
    return definition


def ssm_extend(vars):
    """
        Extends using global and non global vars
        vars -> list of systems manager variables
    """
    result, duplicated_params = [], {}
    for key, item in enumerate(vars):
        if item['name'] not in duplicated_params.keys():
            duplicated_params[item['name']] = []
        duplicated_params[item['name']].append(item)
    for item in duplicated_params:
        if len(duplicated_params[item]) == 1:
            result.append(duplicated_params[item][0])
        elif len(duplicated_params[item]) == 2:
            for duplicate in duplicated_params[item]:
                if 'GLOBAL' not in duplicate['valueFrom']:
                    result.append(duplicate)
    return result