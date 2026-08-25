import json

with open("cfn.outputs") as json_file:
    data = json.load(json_file)

    for key in data:
        if key["OutputKey"].startswith("appsyncEndpoint"):
            appsyncEndpoint = key["OutputValue"]
        if key["OutputKey"] == "region":
            region = key["OutputValue"]
        if key["OutputKey"] == "appsyncId":
            appsyncId = key["OutputValue"]
        if key["OutputKey"] == "publicIdentityPoolId":
            identityPoolId = key["OutputValue"]

    output_data = {
        "Auth": {
            "identityPoolId": identityPoolId,
        },
        "API": {
            "aws_appsync_graphqlEndpoint": appsyncEndpoint,
            "aws_appsync_region": region,
        },
    }

    print(json.dumps(output_data, indent=4))

    with open("website/overlays/src/config.json", "w") as outfile:
        json.dump(output_data, outfile, indent=4)
