#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { rorVPC } from '../lib/vpc-stack';
import { DbRedisStack } from '../lib/db-redis-stack';
import { ecsFargateStack } from '../lib/ecs-fargate-stack';
import { CiCdStack } from '../lib/cicd-stack';


const env = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT
}


const app = new cdk.App();

const vpcStack = new rorVPC(app, 'ror6Vpc', { env })

const dataStack = new DbRedisStack(app, 'postgresDBRedis', {
  vpc: vpcStack.vpc,
  env
})

const ecsFargate = new ecsFargateStack(app, 'RoRFargate', {
  vpc: vpcStack.vpc,
  dbcluster: dataStack.dbcluster,
  dbclusterPassword: dataStack.dbclusterPassword,
  redisCluster: dataStack.redisCluster,
  env
})


new CiCdStack(app, 'RoRChatCiCd',{
  rorChatService: ecsFargate.rorChatService.service,
  ecrRepo: ecsFargate.ecrRepo.repositoryName,
  githubOauthTokenSSM: "",
  githubOwner: "",
  githubRepo: "",
  env
})