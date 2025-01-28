import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';

import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { CodeFirstSchema, Directive, GraphqlType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';
import { StandardLambdaDockerImageFuncion } from './standard-lambda-docker-image-function';

export interface LabelPrinterProps {
  logsbucket: IBucket;
  appsyncApi: {
    schema: CodeFirstSchema;
    api: appsync.IGraphqlApi;
  };
  lambdaConfig: {
    runtime: lambda.Runtime;
    architecture: lambda.Architecture;
    bundlingImage: DockerImage;
    layersConfig: {
      powerToolsLogLevel: string;
      helperFunctionsLayer: lambda.ILayerVersion;
      powerToolsLayer: lambda.ILayerVersion;
    };
  };
  carStatusDataHandlerLambda: lambdaPython.PythonFunction;
}

export class LabelPrinter extends Construct {
  constructor(scope: Construct, id: string, props: LabelPrinterProps) {
    super(scope, id);

    const stack = Stack.of(this);

    // Labels S3 bucket
    const labels_bucket = new s3.Bucket(this, 'labelsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: props.logsbucket,
      serverAccessLogsPrefix: 'access-logs/labels_bucket/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    labels_bucket.policy!.document.addStatements(
      new iam.PolicyStatement({
        sid: 'AllowSSLRequestsOnly',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [labels_bucket.bucketArn, labels_bucket.bucketArn + '/*'],
        conditions: { NumericLessThan: { 's3:TlsVersion': '1.2' } },
      })
    );

    // remove old labels after 10 days
    labels_bucket.addLifecycleRule({
      enabled: true,
      expiration: Duration.days(10),
    });

    const printLabelLambdaFunction = new StandardLambdaDockerImageFuncion(this, 'print_label_func', {
      description: 'Print Label',
      code: lambda.DockerImageCode.fromImageAsset('lib/lambdas/print_label_function', {
        platform: Platform.LINUX_AMD64,
      }),
      timeout: Duration.minutes(1),
      architecture: lambda.Architecture.X86_64,
      memorySize: 256,
      environment: {
        LABELS_S3_BUCKET: labels_bucket.bucketName,
        URL_EXPIRY: '36000',
        POWERTOOLS_SERVICE_NAME: 'print_label',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        CAR_STATUS_DATA_HANDLER_LAMBDA_NAME: props.carStatusDataHandlerLambda.functionName,
      },
    });

    props.carStatusDataHandlerLambda.grantInvoke(printLabelLambdaFunction);
    labels_bucket.grantReadWrite(printLabelLambdaFunction);

    // AppSync Api
    const printableLabelDataSource = props.appsyncApi.api.addLambdaDataSource(
      'printableLabelDataSource',
      printLabelLambdaFunction
    );

    NagSuppressions.addResourceSuppressions(
      printableLabelDataSource,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [
            {
              regex: '/^Resource::(.+):\\*$/g',
            },
          ],
        },
      ],
      true
    );

    const printableLabelObjectType = new ObjectType('carPrintableLabel', {
      definition: {
        printableLabel: GraphqlType.awsUrl(),
      },
    });

    props.appsyncApi.schema.addType(printableLabelObjectType);

    // Event Methods
    props.appsyncApi.schema.addQuery(
      'carPrintableLabel',
      new ResolvableField({
        args: {
          instanceId: GraphqlType.string(),
        },
        dataSource: printableLabelDataSource,
        returnType: GraphqlType.string(),
        directives: [Directive.cognito('admin', 'operator')],
      })
    );
  }
}
