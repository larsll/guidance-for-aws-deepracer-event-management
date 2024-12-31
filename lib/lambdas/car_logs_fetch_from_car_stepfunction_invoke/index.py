import json
import os
import re
import time

import appsync_helpers
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils
from botocore.exceptions import ClientError

tracer = Tracer()
logger = Logger()

client_ssm = boto3.client("ssm")
s3_client = boto3.client("s3")

BAG_UPLOAD_S3_BUCKET = os.environ["BAG_UPLOAD_S3_BUCKET"]


@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)

    jobId = event["data"]["jobId"]
    eventId = event["data"]["eventId"]
    carName = event["data"]["carName"]
    carInstanceId = event["data"]["carInstanceId"]

    start_time = scalar_types_utils.aws_datetime()
    start_time_filename = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    logger.info(f"Start - JobId: {jobId}, carName: {carName}")

    item_started = {
        "jobId": jobId,
        "status": "Started",
        "fetchStartTime": start_time,
        "eventId": eventId,
    }

    try:
        query = """mutation updateFetchFromCarDbEntry($jobId: ID!, $status: String!, $eventId: ID!, $endTime: AWSDateTime, $fetchStartTime: AWSDateTime) {
            updateFetchFromCarDbEntry(jobId: $jobId, status: $status, eventId: $eventId, endTime: $endTime, fetchStartTime: $fetchStartTime) {
                jobId
                status
                eventId
                endTime
                fetchStartTime
            }
        }
        """
        appsync_helpers.send_mutation(query, item_started)

    except Exception as error:
        logger.exception(error)
        return error

    ## SSM code here
    try:

        filename = f"{carName}-{start_time_filename}.txt"
        key = "/".join(["upload", filename])
        # Generate a presigned URL for the S3 object
        try:
            presigned_url = s3_client.generate_presigned_url(
                "put_object",
                Params={"Bucket": BAG_UPLOAD_S3_BUCKET, "Key": key},
                ExpiresIn=300,
            )
            logger.info(presigned_url)
        except ClientError as e:
            logger.error(e)

        response = client_ssm.send_command(
            InstanceIds=[carInstanceId],
            DocumentName="AWS-RunShellScript",
            Parameters={
                "commands": [
                    "cd /tmp",
                    "echo 'Hello, World!' > {0}".format(filename),
                    "curl -X PUT -T /tmp/{0} '{1}'".format(filename, presigned_url),
                ]
            },
        )
        command_id = response["Command"]["CommandId"]
        logger.info(command_id)

        return {
            "carInstanceId": carInstanceId,
            "ssmCommandId": command_id,
        }

    except Exception as error:
        logger.exception(error)
        return error
