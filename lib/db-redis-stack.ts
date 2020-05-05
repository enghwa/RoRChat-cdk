import cdk = require('@aws-cdk/core');
import ec2 = require("@aws-cdk/aws-ec2");
import rds = require('@aws-cdk/aws-rds');
import secretsmanager = require('@aws-cdk/aws-secretsmanager');
import elasticache = require('@aws-cdk/aws-elasticache');

export interface DbRedisProps extends cdk.StackProps {
  // vpcId: string
  vpc: ec2.Vpc
}

export class DbRedisStack extends cdk.Stack {

  public readonly dbcluster: rds.DatabaseCluster;
  public readonly redisCluster: elasticache.CfnReplicationGroup;
  public readonly dbclusterPassword: secretsmanager.Secret;

  constructor(scope: cdk.Construct, id: string, props: DbRedisProps) {
    super(scope, id, props);


    const vpc = props.vpc

    //redis cache cluster
    const redisSecurityGroup: ec2.SecurityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc
    });
    const subnetGroup: elasticache.CfnSubnetGroup =
      new elasticache.CfnSubnetGroup(this, 'SubnetGroup', {
        cacheSubnetGroupName: `redis-${this.stackName.toLowerCase()}`,
        description: `Subnets for redis cache`,
        subnetIds: vpc.selectSubnets({ subnetName: 'Private' }).subnetIds
      });
    redisSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(6379), 'Allow from all on port 6379');
    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'Redis', {
      replicationGroupId: `redis-${this.stackName.toLowerCase()}`,
      replicationGroupDescription: 'redis',
      cacheNodeType: 'cache.t2.micro',
      engine: 'redis',
      cacheParameterGroupName: 'default.redis5.0',
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      securityGroupIds: [redisSecurityGroup.securityGroupId],
      numCacheClusters: 1,
      automaticFailoverEnabled: false
    });

    // database cluster
    this.dbclusterPassword = new secretsmanager.Secret(this, 'DBSecret', {
      secretName: `ROR-DBPassword-${this.stackName.toLowerCase()}`,
      generateSecretString: {
        excludePunctuation: true
      }
    });

    const dbSecuritygroup = new ec2.SecurityGroup(this, 'postgres-dbsg', {
      vpc,
      description: "postgres database security group"
    })
    dbSecuritygroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5432), "Allow inbound to db")


    this.dbcluster = new rds.DatabaseCluster(this, 'db-cluster', {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      engineVersion: "10.7",
      instances: 1,
      port: 5432,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      parameterGroup: { parameterGroupName: 'default.aurora-postgresql10' } as any,
      masterUser: {
        username: this.node.tryGetContext('dbMasterUser') || 'dbaadmin',
        password: this.dbclusterPassword.secretValue
      },
      defaultDatabaseName: this.node.tryGetContext('DatabaseName') || 'demoDB',
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
        securityGroup: dbSecuritygroup,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE,
        },
        vpc
      }
    })

  }
}