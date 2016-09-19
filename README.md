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
- [Keywords for numbers](#keywords-for-numbers)
    - [exclusiveMaximum / exclusiveMinimum](#maximum--minimum-and-exclusivemaximum--exclusiveminimum)
    - [divisibleBy draft-03]
    - [multipleOf draft-04]
- [Keywords for strings](#keywords-for-strings)
    - [formatMaximum / formatMinimum and formatExclusiveMaximum / formatExclusiveMinimum] (v5)
- [Keywords for arrays](#keywords-for-arrays)
    - [maxItems/minItems](#maxitems--minitems)
    - [uniqueItems]
    - [additionalItems]
    - [contains](#contains-v5-proposal) (v5)
- [Keywords for objects](#keywords-for-objects)
    - [maxProperties/minProperties](#maxproperties--minproperties)
    - [required draft-v04](#required)
    - [patternProperties](#patternproperties)
    - [additionalProperties](#additionalproperties)
    - [dependencies](#dependencies)
    - [patternGroups](#patterngroups-v5-proposal) (v5)
    - [patternRequired](#patternrequired-v5-proposal) (v5)
- [Keywords for all types](#keywords-for-all-types)
    - [enum](#enum)
    - [constant](#constant-v5-proposal) (v5)
    - [not](#not)
    - [oneOf](#oneof)
    - [anyOf](#anyof)
    - [allOf](#allof)
    - [switch](#switch-v5-proposal) (v5)

It's still a work in progress...
Code has not been refactored, prettified or modularized as of this moment.
Currently on prototyping phase.
No automated test as of the moment.
