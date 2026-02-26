"""
Batch module
"""

def get_latest_batch_revision(client, family):
    """Get lateset batch job revison

    Args:
        client (obj): Boto3 batch client
        family (str): Job family string

    Returns:
        list: List of the job definitions
    """
    return client.describe_job_definitions(
        maxResults=1,
        jobDefinitionName=family,
    )['jobDefinitions'][-1]