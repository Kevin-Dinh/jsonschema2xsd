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
        maxLength: "xs:maxLength",
        minLength: "xs:minLength",
        pattern: "xs:pattern",
        format: {
            "date-time": "xs:dateTime",
            date: "xs:date",
            time: "xs:time"
        },
        formatMaximum: "xs:formatMaximum",
        formatMinimum: "xs:formatMinimum",
        formatExclusiveMaximum: "xs:formatExclusiveMaximum",
        formatExclusiveMinimum: "xs:formatExclusiveMinimum"
    },
    number: {
        maximum: "xs:maxInclusive",
        minimum: "xs:minInclusive"
    },
    integer: {
        positiveInteger: "xs:positiveInteger",
        nonPositiveInteger: "xs:nonPositiveInteger",
        negativeInteger: "xs:negativeInteger",
        nonNegativeInteger: "xs:nonNegativeInteger",
        maximum: "xs:maxInclusive",
        minimum: "xs:minInclusive",
        multipleOf: "xs:multipleOf"
    },
    types: {
        string: "xs:string",
        number: "xs:integer",
        integer: "xs:integer",
        boolean: "xs:boolean"
    },
    common: {
        enum: "xs:enumeration"
    }
};

var xw = new XMLWriter();
var rootElement;
var rootElementSet;

function setRestrictions(obj, type) {
    //set restrictions if any
    if (_.isObject(obj)) {
        var xsdkey, value = JSONSchemaKeywordsXSDMappings.types[type];
        var disregard = [];
        if (_.isString(type) && type === "integer") {
            var minimum = _.isNumber(obj.minimum) && obj.minimum;
            var exclusiveMinimum = obj.exclusiveMinimum;
            var maximum = _.isNumber(obj.maximum) && obj.maximum;
            var exclusiveMaximum = obj.exclusiveMaximum;

            if (minimum === 0 && _.isBoolean(exclusiveMinimum)) {
                value = exclusiveMinimum
                    ? JSONSchemaKeywordsXSDMappings.integer.positiveInteger
                    : JSONSchemaKeywordsXSDMappings.integer.nonPositiveInteger;
                _.merge(disregard, ["minimum", "exclusiveMinimum"]);
            }
            if (maximum === 0 && _.isBoolean(exclusiveMaximum)) {
                value = (exclusiveMaximum)
                    ? JSONSchemaKeywordsXSDMappings.integer.negativeInteger
                    : JSONSchemaKeywordsXSDMappings.integer.nonNegativeInteger;
                _.merge(disregard, ["maximum", "exclusiveMaximum"]);
            }
        }

        // get intersecting key for the given object in JSON Schema Keywords definition. Process only known keys
        // then do not include keys (by difference/differentiating) if define in disregard for it has been processed already.
        var filtered = _.difference(_.concat(
            _.intersection(Object.keys(obj), JSONSchemaKeywords[type]),
            _.intersection(Object.keys(obj), JSONSchemaKeywords.common)
        ), disregard);

        if (filtered.length > 0) {
            var format = obj && obj.format;
            xw.startElement("xs:simpleType").startElement("xs:restriction");

            if (_.isString(format)) {
                var dateformat = _.pick(JSONSchemaKeywordsXSDMappings.string.format, [format]);
                value = (dateformat && dateformat[format])
                    ? dateformat[format]
                    : value;
            }
            xw.writeAttribute("base", (_.isString(value))
                ? value
                : "");

            _.each(filtered, function (item) {
                switch (item) {
                case "enum":
                    xsdkey = JSONSchemaKeywordsXSDMappings.common[item];
                    break;
                case "format":
                    //skip
                    break;
                default:
                    xsdkey = JSONSchemaKeywordsXSDMappings[type][item];
                    break;
                }
                if (_.isString(xsdkey)) {
                    if (_.isArray(obj[item])) {
                        _.each(obj[item], function (r) {
                            xw.startElement(xsdkey);
                            xw.writeAttribute("value", r);
                            xw.endElement();
                        });
                    } else {
                        xw.startElement(xsdkey);
                        xw.writeAttribute("value", obj[item]);
                        xw.endElement();
                    }
                }
            });

            xw.endElement().endElement(); //restriction closing tag and simpleType closing tag
        } else {
            //no valid restrictions. setting element type instead
            xw.writeAttribute("type", (_.isString(value))
                ? value
                : "");
        }
    }
}

function setElementTypeAndAttributes(obj, key, objTypeAsDefinedInJSONSchema) {
    var title = obj && obj.title;
    var description = obj && obj.description;
    var type = obj && obj.type;
    var required = obj && obj.required;
    if (_.isString(title)) {
        xw.writeComment(title);
    }
    if (_.isString(description)) {
        xw.writeComment(description);
    }
    xw.startElement("xs:element");
    if (_.isString(key)) {
        xw.writeAttribute("name", key);
    }
    if (_.isArray(type)) {
        _.each(type, function (t) {
            if (t === "null") {
                xw.writeAttribute("nillable", "true");
                return false;
            }
        });
    }

    if (_.isBoolean(required) && required) {
        xw.writeAttribute("minOccurs", "1");
        xw.writeAttribute("maxOccurs", "1");
    }

    setRestrictions(obj, objTypeAsDefinedInJSONSchema);
    xw.endElement(); // element closing tag
}

function processTypeObject(obj) {
    var properties = obj && obj.properties;
    var firstpass = false;
    if (!rootElementSet) {
        xw.startElement("xs:element").writeAttribute("name", rootElement);
        rootElementSet = true;
        firstpass = true;
    }
    xw.startElement("xs:complexType");
    xw.startElement("xs:sequence");
    if (_.isObject(properties)) {
        processObject(properties);
    }
    xw.endElement().endElement(); //sequence closing tag and complexType closing tag

    if (firstpass) {
        xw.endElement();
    }
}

function processTypeArray(obj, key) {
    if (!rootElementSet) {
        xw.startElement("xs:element").writeAttribute("name", rootElement);
        rootElementSet = true;
    } else {
        xw.startElement("xs:element");
        xw.writeAttribute("name", key);
    }
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
        //ROOT Element
        rootElement = (options && _.isString(options.rootElement))
            ? options.rootElement
            : "ROOT_OBJECT";
    } else {
        xw.writeAttribute("xmlns:xs", "http://www.w3.org/2001/XMLSchema");
    }
    processObject(jsonData);
    xw.endElement().endDocument();
    return pd.xml(xw.toString());
};