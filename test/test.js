const { expect } = require('chai');
const faker = require('faker');

const elasticsearch = require('@elastic/elasticsearch');
const { createConnector } = require('../index');

const region = process.env.AWS_REGION || 'us-east-1';
const domain = process.env.AWS_ES_DOMAIN;

const client = new elasticsearch.Client({
  nodes: [ domain ],
  Connection: createConnector({ region })
});

describe('client', () => {
  const term = faker.lorem.word();

  it('should index a document', () => {
    const index = 'test';
    const doc = { test: term };
    const params = {
      index,
      body: doc,
      refresh: true
    };
    return client.index(params);
  });

  it('should search', async () => {
    const body = {
      query: {
        term: {
          test: term
        }
      }
    };
    const params = {
      index: 'test',
      body
    };
    let result = await client.search(params);
    expect(result.body.hits.hits.length).above(0);
  })
});
