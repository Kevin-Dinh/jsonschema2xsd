var jpath = require('jsonpath');
var XMLWriter = require('xml-writer');
var pd = require('pretty-data').pd;

var JSONSchemaKeywords = {
    "types": [
        "string",
        "array",
        "object",
        "number",
        "integer",
        "boolean",
        "null"
    ],
    "number": [
        "maximum",
        "minimum",
        "exclusiveMaximum",
        "exclusiveMinimum",
        "multipleOf"
    ],
    "string": [
        "maxLength",
        "minLenght",
        "pattern",
        "format",
        "formatMaximum",
        "formatMinimum",
        "formatExclusiveMaximum",
        "formatExclusiveMinimum" //(v5)
    ],
    "array": [
        "maxItems",
        "minItems",
        "uniqueItems",
        "items",
        "additionalItems",
        "contains" //(v5)
    ],
    "object": [
        "required",
        "properties",
        "patternProperties",
        "additionalProperties",
        "maxProperties",
        "minProperties",
        "dependencies",
        "patternGroups", //(v5)
        "patternRequired"
    ],
    "common": [
        "enum",
        "constant", //(v5)
        "not",
        "oneOf",
        "anyOf",
        "allOf",
        "switch" //(v5)
    ]
}

var xw = new XMLWriter;

module.exports = function(jsonData) {

    xw.startDocument();
    xw.writeAttribute("encoding", "UTF-8");
    xw.startElement("xs:schema");
    xw.writeAttribute("xmlns:xs", "http://www.w3.org/2001/XMLSchema");
    processJSONData(jsonData);
    xw.endElement();
    xw.endDocument();

    return pd.xml(xw.toString());

    function processJSONData(obj, key) {
        var type;
        //check if object
        if (typeof obj == "object") {
            //determine object type as specified if any
            type = jpath.value(obj, "$.type") || "";

            //check if type specified matches json schema keywords for types
            if (JSONSchemaKeywords.types.indexOf(type) >= 0) {
                switch (type) {
                    case "object":
                        //process object types
                        processTypeObject(obj);
                        break;
                    case "array":
                        //process array types
                        processTypeArray(obj);
                        break;
                    case "string":
                        //process string types
                        processTypeString(obj, key);
                        break;
                    case "number":
                        //process number types
                        processTypeNumber(obj, key);
                        break;
                    case "integer":
                        //process integer types
                        processTypeInteger(obj, key);
                        break;
                    case "boolean":
                        //process boolean types
                        break;
                    default:
                        console.log("//default");
                        break;
                }
            }
            else {
                // else traverse and process child objects
                for (var o in obj) {
                    if (!!obj[o] && typeof (obj[o]) == "object") {
                        processJSONData(obj[o], o);
                    }
                };
            }
        }
    }

    function processTypeObject(obj) {
        var title = jpath.value(obj, "$.title");
        var properties = jpath.value(obj, "$.properties");
        var required = jpath.value(obj, "$.required");

        xw.startElement("xs:complexType");
        if (title != undefined) {
            xw.writeAttribute("name", title);
        }
        xw.startElement("xs:sequence");

        if (typeof properties == "object") {
            processJSONData(properties);
        }
        xw.endElement();
        xw.endElement();
    }

    function processTypeArray(obj) {
       xw.startElement("xs:simpleType");
        xw.writeAttribute("name", "array");
        for (var name in obj) {
            processJSONData(obj[name]);
        }
        xw.endElement();
    }

    function processTypeString(obj, key) {
        var type = jpath.value(obj, "$.type");
        xw.startElement("xs:element");
        if (key != undefined) {
            xw.writeAttribute("name", key);
        }
        if (type != undefined) {
            xw.writeAttribute("type", type);
        }
        xw.endElement();
    }

    function processTypeNumber(obj, key) {
        var type = jpath.value(obj, "$.type");
        xw.startElement("xs:element");
        if (key != undefined) {
            xw.writeAttribute("name", key);
        }
        if (type != undefined) {
            xw.writeAttribute("type", type);
        }
        xw.endElement();
    }

    function processTypeInteger(obj, key) {
        var minimum = jpath.value(obj, "$.minimum");
		var maximum = jpath.value(obj, "$.maximum");
        xw.startElement("xs:element");
        if (key != undefined) {
            xw.writeAttribute("name", key);
        }
        if((undefined != minimum) || (undefined != maximum)){
            xw.startElement("xs:simpleType");
            xw.startElement("xs:restriction");
            xw.writeAttribute("base", "xs:integer");
            if (undefined != minimum) {
                xw.startElement("xs:minInclusive");
                xw.writeAttribute("value", minimum);
                xw.endElement();
            }
            if (undefined != maximum) {
                xw.startElement("xs:maxInclusive");
                xw.writeAttribute("value", maximum);
                xw.endElement();
            }
            xw.endElement();
        }
        xw.endElement();
    }
}