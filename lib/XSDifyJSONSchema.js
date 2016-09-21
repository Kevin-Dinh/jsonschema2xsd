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
    "integer": [
        "maximum",
        "minimum",
        "exclusiveMaximum",
        "exclusiveMinimum",
        "multipleOf"
    ],
    "string": [
        "maxLength",
        "minLength",
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
};

var JSONSchemaKeywordsXSDMappings = {
    "string": {
        "maxLength": "maxLength",
        "minLength": "minLength",
        "pattern": "pattern",
        "format": {
            "date-time": "dateTime",
            "date": "date",
            "time": "time"
        },
        "formatMaximum": "formatMaximum",
        "formatMinimum": "formatMinimum",
        "formatExclusiveMaximum": "formatExclusiveMaximum",
        "formatExclusiveMinimum": "formatExclusiveMinimum"
    },
    "number": {
        "maximum": "maxInclusive",
        "minimum": "minInclusive"
    },
    "integer": {
        "maximum": "maxInclusive",
        "minimum": "minInclusive"
    },
    "types": {
        "string": "xs:string",
        "number": "xs:integer",
        "integer": "xs:integer",
        "boolean": "xs:boolean",
        "dateTime": "xs:dateTime",
        "date": "xs:date",
        "time": "xs:time"
    }
};

var xw = new XMLWriter;
var boname;
var topLevelElementDefined = false;

module.exports = function (jsonData, options) {
    xw.startDocument();
    xw.writeAttribute("encoding", "UTF-8");
    xw.startElement("xs:schema");
    if(typeof options.t == "string"){
        xw.writeAttribute("targetNamespace",options.t);
    }
    if(typeof options.x == "string"){
        xw.writeAttribute("xmlns:xs",options.x);
    } else {
        xw.writeAttribute("xmlns:xs","http://www.w3.org/2001/XMLSchema");
    }
    if(typeof options.e == "string"){
        xw.writeAttribute("elementFormDefault",options.e);
    }
    boname = (typeof options.b == "string") ? options.b : "";
    processJSONData(jsonData);
    xw.endElement();
    xw.endDocument();

    return pd.xml(xw.toString());

    function processJSONData(obj, key) {
        //check if object
        if (typeof obj == "object") {

            var type = determineType(obj);
            //check if type specified matches json schema keywords for types
            if (JSONSchemaKeywords.types.indexOf(type) >= 0) {
                switch (type) {
                    case "object":
                        //process object types
                        processTypeObject(obj, key);
                        break;
                    case "array":
                        //process array types
                        processTypeArray(obj, key);
                        break;
                    default:
                        //process string integer number boolean null
                        setElementTypeAndAttributes(obj, key);
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

    function processTypeObject(obj, key) {
        var title = jpath.value(obj, "$.title");
        var properties = jpath.value(obj, "$.properties");
        var required = jpath.value(obj, "$.required");

        xw.startElement("xs:complexType");
        setTagNameAttribute(title);
        xw.startElement("xs:sequence");

        if (typeof properties == "object") {
            processJSONData(properties);
        }
        xw.endElement(); //sequence closing tag
        xw.endElement(); //complexType closing tag
    }

    function processTypeArray(obj, key) {
        xw.startElement("xs:element");
        setTagNameAttribute(key);
        for (var name in obj) {
            processJSONData(obj[name]);
        }
        xw.endElement(); //element closing tag
    }

    function setTagNameAttribute(title){
        if (title != undefined) {
            xw.writeAttribute("name", title);
        } else {
            if(!topLevelElementDefined && boname != ""){
                xw.writeAttribute("name", boname);
                topLevelElementDefined = true;
            }
        }
    }

    function setElementTypeAndAttributes(obj, key) {
        var type = jpath.value(obj, "$.type");

        xw.startElement("xs:element");
        if (undefined != key) {
            xw.writeAttribute("name", key);
        }
        //set nil attributes if any
        if (type != undefined) {
            if (type instanceof Array) {
                for (var t in type) {
                    if ("null" === type[t]) {
                        xw.writeAttribute("nillable", "true");
                    }
                }
            }
        }

        type = determineType(obj);
        //set restrictions if any
        if (typeof obj == "object") {
            var filteredObj, xsdkey, value = type;
            var format = jpath.value(obj, "$.format");
            if ((filteredObj = filterObjectKeys(obj, JSONSchemaKeywords[type])).length > 0) {
                xw.startElement("xs:simpleType");
                xw.startElement("xs:restriction");

                if (format != undefined) {
                    for (var dt in JSONSchemaKeywordsXSDMappings.string.format) {
                        if (dt === format) {
                            value = JSONSchemaKeywordsXSDMappings.string.format[dt];
                            break;
                        }
                    }
                }
                setElementAttribute(value, "base");

                for (var item in filteredObj) {
                    for (var key in filteredObj[item]) {
                        if(key!="format"){
                            xsdkey = jpath.value(JSONSchemaKeywordsXSDMappings, "$." + type + "." + key);
                            if (xsdkey != undefined) {
                                xw.startElement("xs:" + xsdkey);
                                xw.writeAttribute("value", obj[key]);
                                xw.endElement();
                            }
                        }
                    }
                }
                xw.endElement(); //restriction closing tag
                xw.endElement(); //simpleType closing tag
            } else {
                setElementAttribute(type, "type");
            }
        }
        xw.endElement(); // element closing tag      
    }

    function setElementAttribute(value, attrib) {
        var val = jpath.value(JSONSchemaKeywordsXSDMappings, "$.types." + value);
        val = (undefined != val) ? val : type;
        xw.writeAttribute(attrib, val);
    }

    function determineType(obj) {
        //determine object type as specified if any
        var type = jpath.value(obj, "$.type") || "";

        if (typeof type == "object") {
            var getFirst;
            for (var t in type) {
                if (JSONSchemaKeywords.types.indexOf(type[t]) < 0) {
                    //throw Error('Undetermined type found in JSON Schema.\nValid values for type keyword are string or an array.\nIf it is an array MUST be strings and MUST be unique. String values MUST be one of the seven primitive types defined by core specification.');
                    //just proceed
                }
                if (getFirst === undefined && typeof type[t] == "string") {
                    getFirst = type[t];
                }
            }
            type = getFirst;
        }

        return type;
    }

    function filterObjectKeys(obj, accepted) {
        var newObj = [], o;
        if (accepted != undefined) {
            for (var key in obj) {
                if (accepted.indexOf(key) > -1) {
                    o = new Object();
                    o[key] = obj[key];
                    newObj.push(o);
                }
            }
        }
        return newObj;
    }
}