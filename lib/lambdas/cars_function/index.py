import os
from typing import List

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

logger = Logger()

DDB_TABLE_NAME = os.environ["DDB_TABLE"]
DDB_PING_STATE_INDEX_NAME = os.environ["DDB_PING_STATE_INDEX"]
dynamodb = boto3.resource("dynamodb")
client_dynamodb = boto3.client("dynamodb")
paginator_dynamodb = client_dynamodb.get_paginator("query")
client_ssm = boto3.client("ssm")

ddbTable = dynamodb.Table(DDB_TABLE_NAME)


colors = {
    "blue": {"blue_pwm": 9999825, "green_pwm": 0, "red_pwm": 0},
    "red": {"blue_pwm": 0, "green_pwm": 0, "red_pwm": 9999825},
    "marigold": {"blue_pwm": 0, "green_pwm": 5097950, "red_pwm": 9999825},
    "orchid purple": {"blue_pwm": 5019520, "green_pwm": 0, "red_pwm": 5019520},
    "sky blue": {"blue_pwm": 9999825, "green_pwm": 5646960, "red_pwm": 1176450},
    "green": {"blue_pwm": 0, "green_pwm": 9882180, "red_pwm": 4862660},
    "violet": {"blue_pwm": 9999825, "green_pwm": 0, "red_pwm": 9999825},
    "lime": {"blue_pwm": 0, "green_pwm": 9999825, "red_pwm": 9999825},
}


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="carsOnline")
def carOnline(online: str):
    try:
        if online is False:
            PingStatusFilter = "ConnectionLost"
        else:
            PingStatusFilter = "Online"

        return_array = []

        paginateResult = paginator_dynamodb.paginate(
            TableName=DDB_TABLE_NAME,
            IndexName=DDB_PING_STATE_INDEX_NAME,
            KeyConditionExpression="PingStatus=:ping_status",
            ExpressionAttributeValues={":ping_status": {"S": PingStatusFilter}},
        )

        for page in paginateResult:
            logger.info(page)

            for item in page["Items"]:
                new_item = {}
                for key in item:
                    new_item[key] = list(item[key].values())[0]
                logger.info(new_item)

                if "IsLatestVersion" in new_item:
                    new_item["IsLatestVersion"] = str(new_item["IsLatestVersion"])

                return_array.append(new_item)

        logger.info(return_array)
        return return_array

    except Exception as error:
        logger.exception(error)
        return error


@app.resolver(type_name="Mutation", field_name="carUpdates")
def carUpdates(resourceIds: List[str], fleetId: str, fleetName: str):
    try:
        logger.info(resourceIds)

        for resource_id in resourceIds:
            response = client_ssm.add_tags_to_resource(
                ResourceType="ManagedInstance",
                ResourceId=resource_id,
                Tags=[
                    {"Key": "fleetId", "Value": fleetId},
                    {"Key": "fleetName", "Value": fleetName},
                ],
            )

            logger.info(response)
            partiQLQuery = (
                f'UPDATE "{DDB_TABLE_NAME}" SET fleetId="{fleetId}" SET'
                f' fleetName="{fleetName}" WHERE InstanceId = {resource_id}'
            )
            logger.info(partiQLQuery)
            ddbTable.update_item(
                Key={"InstanceId": resource_id},
                UpdateExpression="set fleetId=:fId, fleetName=:fName",
                ExpressionAttributeValues={":fId": fleetId, ":fName": fleetName},
                ReturnValues="UPDATED_NEW",
            )

        return {"result": "success"}

    except Exception as error:
        logger.exception(error)
        return error


@app.resolver(type_name="Mutation", field_name="carDeleteAllModels")
def carDeleteAllModels(resourceIds: List[str]):
    try:
        logger.info(resourceIds)

        for instance_id in resourceIds:
            # empty the artifacts folder
            logger.info(instance_id)

            response = client_ssm.send_command(
                InstanceIds=[instance_id],
                DocumentName="AWS-RunShellScript",
                Parameters={
                    "commands": [
                        "systemctl stop deepracer-core",
                        "rm -rf /opt/aws/deepracer/artifacts/*",
                        "rm -rf /opt/aws/deepracer/logs/*",
                        "rm -rf /root/.ros/log/*",
                        "systemctl start deepracer-core",
                    ]
                },
            )
            # command_id = response['Command']['CommandId']
            logger.info(response)

        return {"result": "success"}

    except Exception as error:
        logger.exception(error)
        return error


@app.resolver(type_name="Mutation", field_name="carSetTaillightColor")
def carSetTaillightColor(resourceIds: List[str], selectedColor: str):
    try:
        logger.info(resourceIds)

        color = colors.get(selectedColor.lower())
        if color is None:
            color = colors.get("Blue")

        for instance_id in resourceIds:
            rosCommand = (
                "ros2 service call /servo_pkg/set_led_state"
                ' deepracer_interfaces_pkg/srv/SetLedCtrlSrv "{red:'
                f" {color['red_pwm']}, blue: {color['blue_pwm']}, green:"
                f" {color['green_pwm']}}}\""
            )

            callRosService(instance_id, rosCommand)

        return {"result": "success"}
    except Exception as error:
        logger.exception(error)
        return error


@app.resolver(type_name="Mutation", field_name="carEmergencyStop")
def carEmergencyStop(resourceIds: List[str]):
    try:
        logger.info(resourceIds)

        for instance_id in resourceIds:
            rosCommand = (
                "ros2 service call /ctrl_pkg/enable_state"
                ' deepracer_interfaces_pkg/srv/EnableStateSrv "{is_active: false}"'
            )
            callRosService(instance_id, rosCommand)

        return {"result": "success"}
    except Exception as error:
        logger.exception(error)
        return error


def callRosService(instaneId: str, rosCommand: str):
    finalCommand = [
        "#!/bin/bash",
        'export HOME="/home/deepracer"',
        "source /opt/intel/openvino_2021/bin/setupvars.sh",
        "source /opt/aws/deepracer/lib/setup.bash",
        rosCommand,
    ]

    client_ssm.send_command(
        InstanceIds=[instaneId],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": finalCommand},
    )


@app.resolver(type_name="Mutation", field_name="carRestartService")
def carRestartService(resourceIds: List[str]):
    try:
        logger.info(resourceIds)

        for instance_id in resourceIds:
            client_ssm.send_command(
                InstanceIds=[instance_id],
                DocumentName="AWS-RunShellScript",
                Parameters={
                    "commands": [
                        "#!/bin/bash",
                        'export HOME="/home/deepracer"',
                        "systemctl restart deepracer-core",
                    ]
                },
            )

        return {"result": "success"}
    except Exception as error:
        logger.exception(error)
        return error


@app.resolver(type_name="Query", field_name="availableTaillightColors")
def availableTaillightColors():
    return list(colors.keys())
