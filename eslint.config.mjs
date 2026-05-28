// eslint.config.mjs

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

export default [
  ...compat.extends('next/core-web-vitals'),
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],

    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'legacy/**',
    ],

    rules: {
      // Disable base rule
      'no-unused-vars': 'off',

      // Enable TS version
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Enable prefer-const
      'prefer-const': 'error',

      'react-hooks/rules-of-hooks': 'error',
      '@typescript-eslint/no-explicit-any': 'error',

      /*
       * WARNING-LEVEL RULES
       */

      '@typescript-eslint/ban-ts-comment': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'no-shadow': 'warn',

      /*
       * DISABLED NOISE RULES
       */

      '@typescript-eslint/promise-function-async': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      'no-use-before-define': 'off',
      'import/no-anonymous-default-export': 'off',
      'import/no-unused-modules': 'off',
      'import/group-exports': 'off',
      'import/no-extraneous-dependencies': 'off',
      'new-cap': 'off',
      'no-inline-comments': 'off',
    },
  },
]