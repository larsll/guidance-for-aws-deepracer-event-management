# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

FROM public.ecr.aws/lambda/python:3.9
LABEL name=lambda/python/print_label
LABEL version=1.0

ARG CACHE_DATE=1
RUN pip3 install --no-cache-dir awslambdaric boto3 requests aws-lambda-powertools "Pillow==10.3.0" "qrcode==7.3.1" "brother_ql==0.9.4" "simplejson~=3.17"

COPY index.py /var/task/index.py
COPY fonts /var/task/fonts
COPY images /var/task/images
COPY http_response.py /var/task/http_response.py

ENTRYPOINT [ "/var/lang/bin/python3", "-m", "awslambdaric" ]
CMD [ "index.handler" ]