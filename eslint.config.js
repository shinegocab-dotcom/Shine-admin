import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'src/**/*', 'supabase/**/*', 'server.ts'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
