"""Boto3 clients init. Used to import anywhere
"""
import os
import boto3

current_region = os.environ.get('AWS_DEFAULT_REGION', 'us-east-2')

client = boto3.client("ecs", region_name=current_region)
ssm_client = boto3.client('ssm', region_name=current_region)
deploy_client = boto3.client('codedeploy', region_name=current_region)
batch_client = boto3.client('batch', region_name=current_region)
autoscaling_client = boto3.client('application-autoscaling', region_name=current_region)