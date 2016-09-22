/*jslint node: true */
"use strict";

var XMLWriter = require('xml-writer');
var pd = require('pretty-data').pd;
var _ = require('lodash');

var JSONSchemaKeywords = {
    types: ["string", "array", "object", "number", "integer", "boolean", "null"],
    number: ["maximum", "minimum", "exclusiveMaximum", "exclusiveMinimum", "multipleOf"],
    integer: ["maximum", "minimum", "exclusiveMaximum", "exclusiveMinimum", "multipleOf"],
    string: ["maxLength", "minLength", "pattern", "format", "formatMaximum", "formatMinimum", "formatExclusiveMaximum", "formatExclusiveMinimum"],
    array: ["maxItems", "minItems", "uniqueItems", "items", "additionalItems", "contains"],
    object: ["required", "properties", "patternProperties", "additionalProperties", "maxProperties", "minProperties", "dependencies", "patternGroups", "patternRequired"],
    common: ["enum", "constant", "not", "oneOf", "anyOf", "allOf", "switch"]
};

var JSONSchemaKeywordsXSDMappings = {
    string: {
        maxLength: "maxLength",
        minLength: "minLength",
        pattern: "pattern",
        format: {
            "date-time": "dateTime",
            date: "date",
            time: "time"
        },
        formatMaximum: "formatMaximum",
        formatMinimum: "formatMinimum",
        formatExclusiveMaximum: "formatExclusiveMaximum",
        formatExclusiveMinimum: "formatExclusiveMinimum"
    },
    number: {
        maximum: "maxInclusive",
        minimum: "minInclusive"
    },
    integer: {
        maximum: "maxInclusive",
        minimum: "minInclusive",
        multipleOf: "multipleOf"
    },
    types: {
        string: "xs:string",
        number: "xs:integer",
        integer: "xs:integer",
        positiveInteger: "xs:positiveInteger",
        nonPositiveInteger: "xs:nonPositiveInteger",
        negativeInteger: "xs:negativeInteger",
        nonNegativeInteger: "xs:nonNegativeInteger",
        boolean: "xs:boolean",
        dateTime: "xs:dateTime",
        date: "xs:date",
        time: "xs:time"
    }
};

var xw = new XMLWriter();
var businessObjectName;
var topLevelElementDefined = false;

function setElementAttribute(value, attrib) {
    var val = JSONSchemaKeywordsXSDMappings.types[value];
    xw.writeAttribute(attrib, (_.isString(val))
        ? val
        : "");
}

function setRestrictions(obj, type) {
    //set restrictions if any
    if (_.isObject(obj)) {
        var xsdkey, value = type;
        var disregard = [];
        if (_.isString(type) && type === "integer") {
            var minimum = _.isNumber(obj.minimum) && obj.minimum;
            var exclusiveMinimum = obj.exclusiveMinimum;
            var maximum = _.isNumber(obj.maximum) && obj.maximum;
            var exclusiveMaximum = obj.exclusiveMaximum;

            if (minimum === 0 && _.isBoolean(exclusiveMinimum)) {
                value = exclusiveMinimum
                    ? "positiveInteger"
                    : "nonPositiveInteger";
                _.merge(disregard, ["minimum", "exclusiveMinimum"]);
            }
            if (maximum === 0 && _.isBoolean(exclusiveMaximum)) {
                value = (exclusiveMaximum)
                    ? "negativeInteger"
                    : "nonNegativeInteger";
                _.merge(disregard, ["maximum", "exclusiveMaximum"]);
            }
        }

        // get intersecting key for the given object in JSON Schema Keywords definition. Process only known keys
        // then do not include keys if define in disregard for it has been processed already.
        var filtered = _.difference(_.intersection(Object.keys(obj), JSONSchemaKeywords[type]), disregard);

        if (filtered.length > 0) {
            var format = obj && obj.format;
            xw.startElement("xs:simpleType").startElement("xs:restriction");

            if (_.isString(format)) {
                var dateformat = _.pick(JSONSchemaKeywordsXSDMappings.string.format, [format]);
                value = (dateformat && dateformat[format])
                    ? dateformat[format]
                    : value;
            }
            setElementAttribute(value, "base");

            _.each(filtered, function (item) {
                if (item !== "format") {
                    xsdkey = JSONSchemaKeywordsXSDMappings[type][item];
                    if (_.isString(xsdkey)) {
                        xw.startElement("xs:" + xsdkey);
                        xw.writeAttribute("value", obj[item]);
                        xw.endElement();
                    }
                }
            });

            xw.endElement().endElement(); //restriction closing tag and simpleType closing tag
        } else {
            //no valid restrictions. setting element type instead
            setElementAttribute(value, "type");
        }
    }
}

function setElementTypeAndAttributes(obj, key, objTypeAsDefinedInJSONSchema) {
    var description = obj && obj.description;
    if (_.isString(description)) {
        xw.writeComment(description);
    }
    xw.startElement("xs:element");
    if (_.isString(key)) {
        xw.writeAttribute("name", key);
    }

    //set nil attributes if any
    _.each(objTypeAsDefinedInJSONSchema, function (t) {
        if (t === "null") {
            xw.writeAttribute("nillable", "true");
            return false;
        }
    });

    setRestrictions(obj, objTypeAsDefinedInJSONSchema);
    xw.endElement(); // element closing tag
}

function setTagNameAttribute(value) {
    if (_.isString(value)) {
        xw.writeAttribute("name", value);
    } else {
        if (!topLevelElementDefined && businessObjectName !== "") {
            xw.writeAttribute("name", businessObjectName);
            topLevelElementDefined = true;
        }
    }
}

function processTypeObject(obj) {
    var properties = obj && obj.properties;
    xw.startElement("xs:complexType");
    setTagNameAttribute(obj && obj.title);
    xw.startElement("xs:sequence");
    if (_.isObject(properties)) {
        processObject(properties);
    }
    xw.endElement().endElement(); //sequence closing tag and complexType closing tag
}

function processTypeArray(obj, key) {
    xw.startElement("xs:element");
    setTagNameAttribute(key);
    _.each(obj, function (item) {
        processObject(item);
    });
    xw.endElement(); //element closing tag
}

function determineType(obj) {
    //pick object property type
    var t = _.pick(obj, "type"),
        type = "";
    if (_.isString(t.type)) {
        type = t.type;
    } else if (_.isArray(t.type)) {
        type = _.head(t.type);
    }
    return type;
}

function processObject(obj, key) {
    //check if object
    if (_.isObject(obj)) {

        //the object type that is define/set in schema what primitive type or the schema of the instance
        var objTypeAsDefinedInJSONSchema = determineType(obj);
        //check if type specified matches json schema keywords for types
        if (_.indexOf(JSONSchemaKeywords.types, objTypeAsDefinedInJSONSchema) >= 0) {
            switch (objTypeAsDefinedInJSONSchema) {
            case "object":
                processTypeObject(obj, key);
                break;
            case "array":
                //process array types
                processTypeArray(obj, key);
                break;
            default:
                //process string integer number boolean null
                //no type property defined in obj
                setElementTypeAndAttributes(obj, key, objTypeAsDefinedInJSONSchema);
                break;
            }
        } else {
            // else traverse and process child objects
            _.each(obj, function (o, k) {
                if (_.isObject(o)) {
                    processObject(o, k);
                }
            });
        }
    }
}

module.exports = function (jsonData, options) {

    xw.startDocument().writeAttribute("encoding", "UTF-8").startElement("xs:schema");

    if (options) {
        xw.writeAttribute("xmlns:xs", _.isString(options.xmlNamespace)
            ? options.xmlNamespace
            : "http://www.w3.org/2001/XMLSchema");
        if (_.isString(options.targetNamespace)) {
            xw.writeAttribute("targetNamespace", options.targetNamespace);
        }
        if (_.isString(options.elementFormDefault)) {
            xw.writeAttribute("elementFormDefault", options.elementFormDefault);
        }
        //business object name. Top Level (Top Level Global Element name)
        businessObjectName = (options && _.isString(options.topLevel))
            ? options.topLevel
            : "";
    } else {
        xw.writeAttribute("xmlns:xs", "http://www.w3.org/2001/XMLSchema");
    }

    processObject(jsonData);
    xw.endElement().endDocument();
    return pd.xml(xw.toString());
};