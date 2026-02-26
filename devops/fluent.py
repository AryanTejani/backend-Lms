"""Prepare fluent.conf file for the docker image
"""
import os
import sys
import argparse
import logging

from formatter import CustomFormatter
from helpers import prepare_fluentbit_config
from batch import *

### Colored logging
logger = logging.getLogger("Deployment")
logger.setLevel(logging.DEBUG)

ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)

ch.setFormatter(CustomFormatter())

logger.addHandler(ch)

### Arg parser
parser = argparse.ArgumentParser(description='traderlion fluent script for nodejs apps')
parser.add_argument('--service', type=str, help='Service name')
parser.add_argument('--containername', type=str, help='ECS task definition container name')

args = parser.parse_args()

if args.service is None or args.containername is None:
    logger.critical('Specify all of args: --service, --containername')
    sys.exit(0)

service_filter = ('adminapi', 'alerts', 'api', 'lightserver', 'crawler-realtime-pre-regular-post-market', 'web')
file_dir = os.path.dirname(os.path.realpath('__file__'))

if args.service in service_filter:
    logger.info('Filter passed. Creating fluent config file.')
    index_name = args.containername
    if "lightserver" in args.containername:
        index_name = f"{index_name}-{os.environ.get('AWS_DEFAULT_REGION')}"
    logger.info(f'ES_HOST: {os.environ.get("ES_HOST")}')
    content = prepare_fluentbit_config(os.environ.get('ES_HOST', ''), args.containername, logger, index_name, 'no-bucket', upload_s3=False)
    logger.info(content)
    with open(f'{file_dir}/builds/fluent/fluent.conf', 'w') as f:
        f.write(content)