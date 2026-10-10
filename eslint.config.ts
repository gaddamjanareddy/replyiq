import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      'prefer-const': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      /**
       * The widget bundle, copied here from dist/ so the dev server can serve
       * it at /widget.js — the documented local setup. It is gitignored build
       * output, but eslint sees the file on disk and reports ~40 errors in
       * minified code, which looks like the project is broken and is simply
       * someone having run the dev setup as written.
       */
      'apps/web/public/widget.js',
    ],
  },
);
