# jsonschema2xsd
JSON Schema (Draft-03) conversion to XSD.

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

#### Sample JSON Schema
```json
{
    "title": "Person",
    "type": "object",
    "properties": {
        "firstName": {
            "type": "string"
        },
        "lastName": {
            "type": "string"
        },
        "age": {
            "description": "Age in years",
            "type": "integer",
            "minimum": 0
        }
    }
}
```

#### Sample XSD Schema generated by the tool
```xml
<?xml version="1.0"?>
<xs:schema 
  xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Person">
    <xs:sequence>
      <xs:element name="firstName" type="xs:string"/>
      <xs:element name="lastName" type="xs:string"/>
      <!--Age in years-->
      <xs:element name="age">
        <xs:simpleType>
          <xs:restriction base="xs:integer">
            <xs:minInclusive value="0"/>
          </xs:restriction>
        </xs:simpleType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
</xs:schema>
```

## LIMITATIONS
- [Keywords for numbers](#keywords-for-numbers)
    - [divisibleBy](#) draft-03
- [Keywords for strings](#keywords-for-strings)
    - [formatMaximum / formatMinimum and formatExclusiveMaximum / formatExclusiveMinimum] (v5)
- [Keywords for arrays](#keywords-for-arrays)
    - [maxItems/minItems](#maxitems--minitems)
    - [uniqueItems](#) 
    - [additionalItems](#) 
- [Keywords for objects](#keywords-for-objects)
    - [maxProperties/minProperties](#maxproperties--minproperties)
    - [required draft-v04](#required)
    - [patternProperties](#patternproperties)
    - [additionalProperties](#additionalproperties)
    - [dependencies](#dependencies)
- [Keywords for all types](#keywords-for-all-types)
    - [constant](#)
    - [not](#)
    - [oneOf](#)
    - [anyOf](#)
    - [allOf](#)
    - [switch](#)

## REFERENCES

- https://tools.ietf.org/rfcdiff?url1=draft-zyp-json-schema-03.txt&url2=draft-zyp-json-schema-04.txt
- https://docs.oracle.com/cd/E12461_01/140/funtional_artifacts_guide/or-fasg-standards.htm
- http://www.informatik.uni-ulm.de/pm/fileadmin/pm/home/fruehwirth/drafts/Bsc-Nogatz.pdf
- https://spacetelescope.github.io/understanding-json-schema/
- http://json-schema.org/

It's still a work in progress...
Code has not been refactored, prettified or modularized as of this moment.
Currently on prototyping phase.
No automated test as of the moment.
