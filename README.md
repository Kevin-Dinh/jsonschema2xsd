# jsonschema2xsd
JSON Schema conversion to XSD.

## Install
```bash
$ git clone https://github.com/donniegallardo/jsonschema2xsd.git
$ cd  jsonschema2xsd/
$ npm install -g
```

## Running the program
```bash
$ jsonschema2xsd
```

Example command usage:

Command                      | Description
------------------------------|------------
`jsonschema2xsd -h`       | Displays help
`jsonschema2xsd schema.xsd`       | Converts schema file to xsd
`jsonschema2xsd -f schema.xsd`       | Converts schema file to xsd
`jsonschema2xsd -u https://.../basicschema.json`       | Converts schema to xsd
`cat schema.json | jsonschema2xsd`       | Converts pipe data to xsd

It's still a work in progress...
