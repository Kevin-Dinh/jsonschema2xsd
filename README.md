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

## LIMITATIONS
- Does not support yet definitions
- Automated test non existent
- Complex restrictions
- additionalItems
- oneOf
- type arrays
- $ref
- etc...

It's still a work in progress...
Code has not been refactored, prettified or modularized as of this moment.
Currently on prototyping phase.
