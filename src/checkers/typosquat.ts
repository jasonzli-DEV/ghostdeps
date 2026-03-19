import { Ecosystem, RiskSignal } from '../types';

// Top 100 most downloaded packages per ecosystem (hardcoded, no fetch)
const TOP_PACKAGES: Record<Ecosystem, string[]> = {
  npm: [
    'lodash', 'react', 'express', 'axios', 'chalk', 'commander', 'debug', 'request',
    'moment', 'async', 'tslib', 'rxjs', 'uuid', 'classnames', 'prop-types', 'webpack',
    'vue', 'angular', 'typescript', 'eslint', 'jest', 'mocha', 'babel', 'prettier',
    'webpack-dev-server', 'cors', 'dotenv', 'body-parser', 'mongoose', 'bcrypt',
    'jsonwebtoken', 'mysql', 'pg', 'redis', 'socket.io', 'nodemailer', 'sharp',
    'cheerio', 'puppeteer', 'puppeteer-core', 'webpack-cli', 'next', 'nuxt',
    'react-dom', 'react-router', 'react-router-dom', 'redux', 'react-redux',
    'yargs', 'inquirer', 'ora', 'got', 'node-fetch', 'superagent', 'form-data',
    'mime', 'minimist', 'semver', 'glob', 'rimraf', 'mkdirp', 'fs-extra',
    'bluebird', 'q', 'colors', 'underscore', 'core-js', 'regenerator-runtime',
    'ws', 'express-validator', 'multer', 'passport', 'helmet', 'compression',
    'morgan', 'cookie-parser', 'express-session', 'serve-static', 'ejs', 'pug',
    'handlebars', 'nunjucks', 'through2', 'concat-stream', 'readable-stream',
    'stream-browserify', 'buffer', 'events', 'util', 'path-browserify', 'crypto-browserify',
    'querystring-es3', 'url', 'http-browserify', 'https-browserify', 'os-browserify'
  ],
  python: [
    'requests', 'numpy', 'pandas', 'flask', 'django', 'pytest', 'matplotlib', 'scipy',
    'pillow', 'sqlalchemy', 'boto3', 'urllib3', 'click', 'setuptools', 'wheel',
    'certifi', 'pip', 'cryptography', 'pytz', 'six', 'jinja2', 'pyyaml', 'idna',
    'chardet', 'werkzeug', 'markupsafe', 'attrs', 'packaging', 'pyparsing',
    'pytest-cov', 'coverage', 'mock', 'tox', 'virtualenv', 'black', 'flake8',
    'mypy', 'pylint', 'isort', 'autopep8', 'pydantic', 'fastapi', 'uvicorn',
    'gunicorn', 'celery', 'redis', 'psycopg2', 'pymongo', 'elasticsearch',
    'beautifulsoup4', 'lxml', 'scrapy', 'selenium', 'tornado', 'aiohttp',
    'httpx', 'starlette', 'marshmallow', 'alembic', 'pytest-django', 'pytest-asyncio',
    'freezegun', 'faker', 'factory-boy', 'hypothesis', 'responses', 'requests-mock',
    'python-dateutil', 'pyOpenSSL', 'bcrypt', 'passlib', 'itsdangerous', 'more-itertools',
    'colorama', 'tqdm', 'tabulate', 'rich', 'typer', 'argparse', 'configparser',
    'tomli', 'toml', 'python-dotenv', 'environs', 'decouple', 'jsonschema',
    'protobuf', 'grpcio', 'aiobotocore', 's3fs', 'fsspec', 'pyarrow', 'dask'
  ],
  ruby: [
    'rails', 'rake', 'bundler', 'rspec', 'puma', 'nokogiri', 'activerecord',
    'activesupport', 'devise', 'sidekiq', 'pg', 'mysql2', 'redis', 'sinatra'
  ],
  go: [
    'github.com/gin-gonic/gin', 'github.com/gorilla/mux', 'github.com/sirupsen/logrus',
    'github.com/spf13/cobra', 'github.com/spf13/viper', 'github.com/stretchr/testify',
    'google.golang.org/grpc', 'github.com/golang/protobuf', 'github.com/go-sql-driver/mysql'
  ],
  rust: [
    'serde', 'tokio', 'rand', 'clap', 'regex', 'reqwest', 'anyhow', 'thiserror',
    'log', 'env_logger', 'chrono', 'uuid', 'once_cell', 'lazy_static', 'syn'
  ],
  php: [
    'symfony/symfony', 'laravel/framework', 'guzzlehttp/guzzle', 'monolog/monolog',
    'phpunit/phpunit', 'doctrine/orm', 'twig/twig', 'composer/composer'
  ],
  dotnet: [
    'Newtonsoft.Json', 'Microsoft.Extensions.Logging', 'Serilog', 'AutoMapper',
    'Dapper', 'NUnit', 'xUnit', 'Moq', 'FluentAssertions', 'Polly'
  ]
};

// Pure TypeScript Levenshtein distance implementation
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function checkTyposquat(
  packageName: string,
  ecosystem: Ecosystem
): RiskSignal | null {
  // Skip short names
  if (packageName.length < 3) {
    return null;
  }

  // Skip scoped npm packages
  if (ecosystem === 'npm' && packageName.startsWith('@')) {
    return null;
  }

  const topPackages = TOP_PACKAGES[ecosystem] || [];
  const lowerPackageName = packageName.toLowerCase();

  for (const topPackage of topPackages) {
    const lowerTopPackage = topPackage.toLowerCase();
    const distance = levenshteinDistance(lowerPackageName, lowerTopPackage);

    if (distance === 1) {
      return {
        signal: 'typosquat',
        severity: 'high',
        detail: `1 character from '${topPackage}' — possible typosquat`
      };
    }

    if (distance === 2) {
      return {
        signal: 'typosquat',
        severity: 'medium',
        detail: `2 characters from '${topPackage}' — possible typosquat`
      };
    }
  }

  return null;
}
