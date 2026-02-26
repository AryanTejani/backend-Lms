"""
SSM helpers
Returns:
    None:
"""
from aws import ssm_client
from botocore.config import Config
from helpers import ssm_extend


def update_ssm(ssm_vars, service, cluster):
    """
        Updating AWS Systems Manager
        ssm_vars -> list of vars to update [0 -> key, 1-> value]
        service -> AWS ECS service name
    """
    for key in ssm_vars:
        rt_value = None
        if 'crawler-realtime' in cluster:
            if key[0] == 'CRAWLER_ENABLE_BULL_PROCESSING':
                rt_value = 'false'
            if key[0] == 'CRAWLER_DISABLE_RT_SERVER':
                rt_value = 'false'
            Config(retries = dict(max_attempts=20))
        ssm_client.put_parameter(
            Name=f'/{service}-{cluster}/{key[0]}',
            Value=rt_value if rt_value else key[1],
            Type='String',
            Overwrite=True
        )



def get_vars_from_ssm(environment, services_list):
    """Get variables from the SSM and configure secrets list

    Args:
        environment (str): Environment name
        services_list (list): List of the services to get variables

    Returns:
        list: List of variables
    """

    paginator = ssm_client.get_paginator('get_parameters_by_path')
    secrets = []
    delete_tag = {'Key': 'delete', 'Value': '1'}

    for service_path in services_list:
        ssm_path = f'/{environment}/{service_path}'
        response_iterator = paginator.paginate(
            Path = ssm_path
        )

        for page in response_iterator:
            for entry in page['Parameters']:
                name = entry['Name'].split(f'{ssm_path}/')[-1]
                arn = entry['ARN']
                response = ssm_client.list_tags_for_resource(ResourceType='Parameter', ResourceId=entry['Name'])
                if delete_tag not in response['TagList']:
                    secrets.append({
                        "name" : name,
                        "valueFrom" : arn
                    })
    return ssm_extend(secrets)