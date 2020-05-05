import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');

export class rorVPC extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // Our VPC
    this.vpc = new ec2.Vpc(this, "RoR6-vpc", {
      maxAzs: 2,
      natGateways: 1
    })
  }
}