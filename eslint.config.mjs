// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: new URL('.', import.meta.url).pathname,
});

export default [
  ...compat.extends('next/core-web-vitals'),
  ...tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
      rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-use-before-define': [
      'error',
      { variables: false },
    ],
    '@typescript-eslint/promise-function-async': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'import/no-unused-modules': 'off',
    'import/group-exports': 'off',
    'import/no-extraneous-dependencies': 'off',
    'new-cap': 'off',
    'no-inline-comments': 'off',
    'no-shadow': 'warn',
    'no-use-before-define': 'off',
  },
  files: ['src/**/*.ts[x]'],
  ignores: ['legacy', 'node_modules', '.next'],
    },
  ),
];
