import { resolve } from 'node:path';
import { registerInvalidationTests } from './delivery/invalidation.mjs';
import { registerDisableTests } from './delivery/disable.mjs';
import { registerGuardrailTests } from './delivery/guardrails.mjs';
import { registerHostedRoutingTests } from './delivery/hosted-routing.mjs';
import { registerOwnershipTests } from './delivery/ownership.mjs';
import { registerPacketTests } from './delivery/packet.mjs';
import { registerRollbackTests } from './delivery/rollback.mjs';
import { registerReviewRoutingTests } from './delivery/review-routing.mjs';
import { registerTemplateTests } from './delivery/templates.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');

registerOwnershipTests(repositoryRoot);
registerInvalidationTests(repositoryRoot);
registerPacketTests(repositoryRoot);
registerReviewRoutingTests(repositoryRoot);
registerHostedRoutingTests(repositoryRoot);
registerRollbackTests(repositoryRoot);
registerDisableTests(repositoryRoot);
registerGuardrailTests(repositoryRoot);
registerTemplateTests(repositoryRoot);
