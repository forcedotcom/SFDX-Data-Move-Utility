module.exports = {
  extends: ['../.eslintrc.cjs'],
  parserOptions: {
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
  },
};
