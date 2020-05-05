import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import secretsmanager = require('@aws-cdk/aws-secretsmanager');
import ecs_patterns = require('@aws-cdk/aws-ecs-patterns');
import servicediscovery = require('@aws-cdk/aws-servicediscovery');
import logs = require('@aws-cdk/aws-logs');
import rds = require('@aws-cdk/aws-rds');
import elasticache = require('@aws-cdk/aws-elasticache');
import route53 = require('@aws-cdk/aws-route53');
import elbv2 = require("@aws-cdk/aws-elasticloadbalancingv2");
import ecr = require('@aws-cdk/aws-ecr');
import acm = require('@aws-cdk/aws-certificatemanager');


export interface ecsFargateProps extends cdk.StackProps {
  // vpcId: string,
  vpc: ec2.Vpc
  dbcluster: rds.DatabaseCluster;
  redisCluster: elasticache.CfnReplicationGroup;
  dbclusterPassword: secretsmanager.Secret
}

export class ecsFargateStack extends cdk.Stack {

  public readonly rorChatService: ecs_patterns.ApplicationLoadBalancedFargateService
  public readonly ecrRepo: ecr.Repository

  constructor(scope: cdk.Construct, id: string, props: ecsFargateProps) {
    super(scope, id, props);

    const vpc = props.vpc

    this.ecrRepo = new ecr.Repository(this, 'ror-ecrRepo', {
      repositoryName: `ror6chat-${this.stackName.toLowerCase()}`,
      lifecycleRules: [{ maxImageCount: 5 }],
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    //Our ECS Fargate Cluster in this VPC
    const fargateEcsCluster = new ecs.Cluster(this, "RoR-ecs", {
      vpc,
      clusterName: `RoRCluster-${this.stackName.toLowerCase()}`,
      defaultCloudMapNamespace: {
        name: "ror.service",
        type: servicediscovery.NamespaceType.DNS_PRIVATE
      }
    })
    const logGroup = new logs.LogGroup(this, "rorLogGroup", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK
    })
    const logDriver = ecs.LogDrivers.awsLogs({
      streamPrefix: "RoRChat",
      logGroup
    });

    // const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "hostedZone", {
    //   hostedZoneId: this.node.tryGetContext('hostedZoneId'),
    //   zoneName: this.node.tryGetContext('hostedZoneName')
    // })

    // const albSSLCert = new acm.DnsValidatedCertificate(this, 'SSLCertificate', {
    //   hostedZone,
    //   domainName: this.node.tryGetContext('hostedZoneName'),
    //   region: this.region
    // });


    this.rorChatService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'RoR app svc', {
      cluster: fargateEcsCluster,
      desiredCount: 1,
      cpu: 256,
      memoryLimitMiB: 512,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('./RoRChat', { file: 'Dockerfile.fargate' }),
        containerPort: 8010,
        logDriver,
        environment: {
          'DATABASE_HOST': props.dbcluster.clusterEndpoint.hostname,
          'DATABASE_PORT': '5432',
          'PRODUCTION_DATABASE': this.node.tryGetContext('DatabaseName') || 'demoDB',
          'DATABASE_USERNAME': this.node.tryGetContext('dbMasterUser') || 'dbaadmin',
          'REDIS_URL': 'redis://' + props.redisCluster.attrPrimaryEndPointAddress + ':6379'
        },
        secrets: {
          'DATABASE_PASSWORD': ecs.Secret.fromSecretsManager(props.dbclusterPassword)
        }
      },
      // domainName: this.node.tryGetContext('hostedZoneName'),
      // domainZone: hostedZone,
      // protocol: elbv2.ApplicationProtocol.HTTPS
    })

    this.ecrRepo.grantPull(this.rorChatService.taskDefinition.obtainExecutionRole())
    // this.rorChatService.listener.addCertificateArns('sslCert', [albSSLCert.certificateArn])
    this.rorChatService.targetGroup.configureHealthCheck({
      "port": 'traffic-port',
      "path": '/',
      "interval": cdk.Duration.seconds(5),
      "timeout": cdk.Duration.seconds(4),
      "healthyThresholdCount": 2,
      "unhealthyThresholdCount": 2,
      "healthyHttpCodes": "200,301,302"
    })
  }
}