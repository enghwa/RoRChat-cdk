import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as RoRChatCdk from '../lib/vpc-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new RoRChatCdk.rorVPC(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
