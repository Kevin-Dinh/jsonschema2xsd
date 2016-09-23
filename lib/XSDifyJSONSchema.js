/*jslint node: true */
"use strict";

var XMLWriter = require('xml-writer');
var pd = require('pretty-data').pd;
var _ = require('lodash');

// JSK (JSON Schema Keywords)
var JSK = {
    types: ["string", "array", "object", "number", "integer", "boolean", "null"],
    number: ["maximum", "minimum", "exclusiveMaximum", "exclusiveMinimum", "multipleOf"],
    integer: ["maximum", "minimum", "exclusiveMaximum", "exclusiveMinimum", "multipleOf"],
    string: ["maxLength", "minLength", "pattern", "format", "formatMaximum", "formatMinimum", "formatExclusiveMaximum", "formatExclusiveMinimum"],
    array: ["maxItems", "minItems", "uniqueItems", "items", "additionalItems", "contains"],
    object: ["required", "properties", "patternProperties", "additionalProperties", "maxProperties", "minProperties", "dependencies", "patternGroups", "patternRequired"],
    common: ["enum", "constant", "not", "oneOf", "anyOf", "allOf", "switch"]
};

// JStoXSD (JSON Schema Keywords to it's XSD Keyword equivalent)
var JStoXSD = {
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

//XSDK (XSD Keywords Dictionary)
var XSDK = {
    schema: "xs:schema",
    defaultSchema: "http://www.w3.org/2001/XMLSchema",
    defaultRoot: "ROOT_OBJECT",
    element: "xs:element",
    sequence: "xs:sequence",
    simpleType: "xs:simpleType",
    complexType: "xs:complexType",
    restrictions: "xs:restriction",
    attribs: {
        xmlns: "xmlns:xs",
        targetNamespace: "targetNamespace",
        encoding: "encoding",
        elementFormDefault: "elementFormDefault",
        type: "type",
        name: "name",
        value: "value",
        base: "base",
        ref: "ref",
        id: "id",
        default: "default",
        fixed: "fixed",
        form: "form",
        maxOccurs: "maxOccurs",
        minOccurs: "minOccurs",
        nillable: "nillable",
        abstract: "abstract"
    }
};

var xw;
var rootElement;
var rootElementSet;

function setRestrictions(obj, type) {
    //set restrictions if any
    if (_.isObject(obj)) {
        var xsdkey, value = JStoXSD.types[type];
        var disregard = [];
        if (_.isString(type) && type === "integer") {
            if (_.isNumber(obj.minimum) && obj.minimum === 0 && _.isBoolean(obj.exclusiveMinimum)) {
                value = obj.exclusiveMinimum
                    ? JStoXSD.integer.positiveInteger
                    : JStoXSD.integer.nonPositiveInteger;
                _.merge(disregard, ["minimum", "exclusiveMinimum"]);
            }
            if (_.isNumber(obj.maximum) && obj.maximum === 0 && _.isBoolean(obj.exclusiveMaximum)) {
                value = (obj.exclusiveMaximum)
                    ? JStoXSD.integer.negativeInteger
                    : JStoXSD.integer.nonNegativeInteger;
                _.merge(disregard, ["maximum", "exclusiveMaximum"]);
            }
        }

        // get intersecting key for the given object in JSON Schema Keywords definition. Process only known keys
        // then do not include keys (by difference/differentiating) if define in disregard for it has been processed already.
        var filtered = _.difference(_.concat(
            _.intersection(Object.keys(obj), JSK[type]),
            _.intersection(Object.keys(obj), JSK.common)
        ), disregard);

        if (filtered.length > 0) {
            var format = obj && obj.format;
            xw.startElement(XSDK.simpleType).startElement(XSDK.restrictions);

            if (_.isString(format)) {
                var dateformat = _.pick(JStoXSD.string.format, [format]);
                value = (dateformat && dateformat[format])
                    ? dateformat[format]
                    : value;
            }
            xw.writeAttribute(XSDK.attribs.base, (_.isString(value))
                ? value
                : "");

            _.each(filtered, function (item) {
                switch (item) {
                case "enum":
                    xsdkey = JStoXSD.common[item];
                    break;
                case "format":
                    //skip
                    break;
                default:
                    xsdkey = JStoXSD[type][item];
                    break;
                }
                if (_.isString(xsdkey)) {
                    if (_.isArray(obj[item])) {
                        _.each(obj[item], function (r) {
                            xw.startElement(xsdkey).writeAttribute(XSDK.attribs.value, r).endElement();
                        });
                    } else {
                        xw.startElement(xsdkey).writeAttribute(XSDK.attribs.value, obj[item]).endElement();
                    }
                }
            });

            xw.endElement().endElement(); //restriction closing tag and simpleType closing tag
        } else {
            //no valid restrictions. setting element type instead
            xw.writeAttribute(XSDK.attribs.type, (_.isString(value))
                ? value
                : "");
        }
    }
}

function processOtherTypes(obj, key, objTypeAsDefinedInJSONSchema) {
    var title = obj && obj.title,
        description = obj && obj.description,
        type = obj && obj.type,
        required = obj && obj.required;

    if (_.isString(title)) xw.writeComment(title);
    if (_.isString(description)) xw.writeComment(description);

    xw.startElement(XSDK.element);
    if (_.isString(key)) xw.writeAttribute(XSDK.attribs.name, key);

    if (_.isArray(type)) {
        _.each(type, function (t) {
            if (t === "null") {
                xw.writeAttribute(XSDK.attribs.nillable, "true");
                return false;
            }
        });
    }

    if (_.isBoolean(required) && required) {
        xw.writeAttribute(XSDK.attribs.minOccurs, "1").writeAttribute(XSDK.attribs.maxOccurs, "1");
    }

    setRestrictions(obj, objTypeAsDefinedInJSONSchema);
    xw.endElement(); // element closing tag
}

function processTypeObject(obj) {
    var properties = obj && obj.properties;
    var firstpass = false;
    if (!rootElementSet) {
        xw.startElement(XSDK.element).writeAttribute(XSDK.attribs.name, rootElement);
        rootElementSet = true;
        firstpass = true;
    }
    xw.startElement(XSDK.complexType).startElement(XSDK.sequence);
    if (_.isObject(properties)) processObject(properties);
    xw.endElement().endElement(); //sequence closing tag and complexType closing tag

    if (firstpass) xw.endElement(); //root element closing tag
}

function processTypeArray(obj, key) {
    if (!rootElementSet) {
        xw.startElement(XSDK.element).writeAttribute(XSDK.attribs.name, rootElement);
        rootElementSet = true;
    } else {
        xw.startElement(XSDK.element).writeAttribute(XSDK.attribs.name, key);
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
    if (_.isString(t.type)) type = t.type;
    else if (_.isArray(t.type)) type = _.head(t.type);
    return type;
}

function processObject(obj, key) {
    //check if object
    if (_.isObject(obj)) {

        //the object type that is define/set in schema what primitive type or the schema of the instance
        var objTypeAsSpecifiedInJSONSchema = determineType(obj);
        //check if type specified matches json schema keywords for types
        if (_.indexOf(JSK.types, objTypeAsSpecifiedInJSONSchema) >= 0) {
            switch (objTypeAsSpecifiedInJSONSchema) {
            case "object":
                //process object type
                processTypeObject(obj, key);
                break;
            case "array":
                //process array type
                processTypeArray(obj, key);
                break;
            default:
                //process other types like string integer number boolean etc...
                processOtherTypes(obj, key, objTypeAsSpecifiedInJSONSchema);
                break;
            }
        } else {
            //no type property defined in obj
            // else traverse and process child objects
            _.each(obj, function (o, k) {
                if (_.isObject(o)) processObject(o, k);
            });
        }
    }
}

module.exports = function (json, o) {

    xw = new XMLWriter();
    rootElementSet = false;

    xw.startDocument().writeAttribute(XSDK.attribs.encoding, "UTF-8").startElement(XSDK.schema);
    xw.writeAttribute(XSDK.attribs.xmlns, o && _.isString(o.xmlNamespace)
            ? o.xmlNamespace
            : XSDK.defaultSchema);

    if (o && _.isString(o.targetNamespace)) xw.writeAttribute(XSDK.attribs.targetNamespace, o.targetNamespace);
    if (o && _.isString(o.elementFormDefault)) xw.writeAttribute(XSDK.attribs.elementFormDefault, o.elementFormDefault);

    //ROOT Element. business object name. Top Level (Top Level Global Element name)
    rootElement = (o && _.isString(o.rootElement))
        ? o.rootElement
        : XSDK.defaultRoot;

    processObject(json);

    xw.endElement().endDocument();
    return pd.xml(xw.toString());
};