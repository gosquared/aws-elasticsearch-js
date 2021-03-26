# AWS Elasticsearch
Use Elastic's official [elasticsearch-js](https://github.com/elastic/elasticsearch-js) with Amazon Elasticsearch.

# Install
    npm i aws-elasticsearch

# Usage
```js
const elasticsearch = require('@elastic/elasticsearch');
const { createConnector } = require('aws-elasticsearch');

const region = process.env.AWS_REGION || 'us-east-1';
const domain = 'https://domain-1-abc123.region.es.amazonaws.com/';

const client = new elasticsearch.Client({
  nodes: [ domain ],
  Connection: createConnector({ region })
});

// use in the normal way
async function example() {
  await client.index({ index: 'test', doc: { test: 'hello' } });
  await client.indices.refresh();
  let result = await client.search({ index: 'test' });
}
example();
```

# Credentials
The connector will use AWS credentials from the environment.

If you have another method of loading / refreshing credentials, you can pass them using `getCreds`:
```js
// heads up: this is called on every request
const getCreds = cb => {
  // load creds from somewhere...
  const credentials = { accessKeyId, secretAccessKey };
  // or credentials = { sessionToken }
  const err = null; // if you give an error, the request will abort
  cb(err, credentials);
};
createConnector({ region, getCreds });
```

# Options
```js
// options and example values
const options = {
  region: 'us-east-1', // AWS region (defaults to process.env.AWS_REGION)
  getCreds: cb => cb(err, credentials) // see above
};
createConnector(options);
```

# Test
```bash
# make sure aws creds are defined in the environment
AWS_REGION=us-east-1 \
AWS_ES_DOMAIN=https://domain-1-abc123.region.es.amazonaws.com/ \
npm test
```

# Troubleshooting
If you get status code 403:

* check your code is running with the right role / aws access credentials.
* make sure your role / user is authorised in the domain's [access policy](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-ac.html), or choose "allow open access to the domain" [if your domain is in VPC](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-vpc.html#es-vpc-security).
* make sure you've allowed your user/role if you're using aws elasticsearch's [security and access management](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/fgac.html#fgac-access-control).
  * One quick way to do this is go to Kibana > Security > roles > all_access > mapped users > manage mapping > users/backend roles and add the ARNs there.
