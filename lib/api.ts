import { Duration, CfnOutput } from 'aws-cdk-lib'
import { Construct } from "constructs";
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apig from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import * as path from 'path'

interface DocumentManagementAPIProps {
    documentBucket: s3.IBucket
}

export class DocumentManagementAPI extends Construct {
    public readonly httpApi: apig.HttpApi

    constructor(scope: Construct, id: string, props: DocumentManagementAPIProps) {
        super(scope, id)

        const getDocumentsFunction = new lambda.NodejsFunction(this, 'GetDocumentsFunction', {
            runtime: Runtime.NODEJS_12_X,
            entry: path.join(__dirname, '..', 'api', 'getDocuments', 'index.ts'),
            handler: 'getDocuments',
            bundling: {
                externalModules: [
                    'aws-sdk'
                ]
            },
            environment: {
                DOCUMENTS_BUCKET_NAME: props.documentBucket.bucketName
            }
        })

        const bucketPermissions = new iam.PolicyStatement()
        bucketPermissions.addResources(`${props.documentBucket.bucketArn}/*`)
        bucketPermissions.addActions('s3:GetObject', 's3:PutObject')
        getDocumentsFunction.addToRolePolicy(bucketPermissions)

        const bucketContainerPermissions = new iam.PolicyStatement()
        bucketContainerPermissions.addResources(props.documentBucket.bucketArn)
        bucketContainerPermissions.addActions('s3:ListBucket')
        getDocumentsFunction.addToRolePolicy(bucketContainerPermissions)

        this.httpApi = new apig.HttpApi(this, 'HttpAPI', {
            apiName: 'document-management-api',
            createDefaultStage: true,
            corsPreflight: {
                allowMethods: [apig.CorsHttpMethod.GET],
                allowOrigins: ['*'],
                maxAge: Duration.days(10),
            }
        })

        const integration = new HttpLambdaIntegration('GetDocumentsIntegration', getDocumentsFunction)

        this.httpApi.addRoutes({
            path: '/getDocuments',
            methods: [
                apig.HttpMethod.GET
            ],
            integration: integration
        });

        new CfnOutput(this, 'APIEndpoint', {
            value: this.httpApi.url!,
            exportName: 'APIEndpoint'
        })
    }
}