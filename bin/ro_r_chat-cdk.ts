#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RoRChatCdkStack } from '../lib/ro_r_chat-cdk-stack';

const app = new cdk.App();
new RoRChatCdkStack(app, 'RoRChatCdkStack');
