'use strict';

const FORBIDDEN_PATTERNS = [/getty_public_token/, /getty_admin_token/, /[?&]token=/];

module.exports = {
  meta: {
    name: 'no-legacy-token-direct',
    type: 'problem',
    docs: {
      description: 'Disallow direct legacy token cookie/query parsing outside token-compat.js',
      recommended: false,
    },
    messages: {
      legacyTokenDirect:
        'Direct legacy token access detected. Use tokenCompat.getLegacyToken()/legacyTokenSuffix/appendTokenIfNeeded instead.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();

    if (/public[\\/ ]js[\\/ ]lib[\\/ ]token-compat\.js$/.test(filename)) {
      return {};
    }
    function report(node) {
      context.report({ node, messageId: 'legacyTokenDirect' });
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (FORBIDDEN_PATTERNS.some((p) => p.test(node.value))) {
          report(node);
        }
      },
      TemplateElement(node) {
        const raw = (node.value && node.value.raw) || '';
        if (FORBIDDEN_PATTERNS.some((p) => p.test(raw))) {
          report(node);
        }
      },
      Identifier(node) {
        if (FORBIDDEN_PATTERNS.some((p) => p.test(node.name))) {
          report(node);
        }
      },
    };
  },
};
