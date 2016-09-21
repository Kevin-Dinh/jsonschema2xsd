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
        "positiveInteger": "xs:positiveInteger",
        "nonPositiveInteger": "xs:nonPositiveInteger",
        "negativeInteger": "xs:negativeInteger",
        "nonNegativeInteger": "xs:nonNegativeInteger",
        "boolean": "xs:boolean",
        "dateTime": "xs:dateTime",
        "date": "xs:date",
        "time": "xs:time"
    }
};

var xw = new XMLWriter;
var businessObjectName;
var topLevelElementDefined = false;

module.exports = function (jsonData, options) {
    xw.startDocument();
    xw.writeAttribute("encoding", "UTF-8");
    xw.startElement("xs:schema");
    if(typeof options.targetNamespace == "string"){
        xw.writeAttribute("targetNamespace",options.targetNamespace);
    }
    if(typeof options.xmlNamespace == "string"){
        xw.writeAttribute("xmlns:xs",options.xmlNamespace);
    } else {
        xw.writeAttribute("xmlns:xs","http://www.w3.org/2001/XMLSchema");
    }
    if(typeof options.elementFormDefault == "string"){
        xw.writeAttribute("elementFormDefault",options.elementFormDefault);
    }
    //business object name. Top Level (Top Level Global Element name)
    businessObjectName = (typeof options.topLevel == "string") ? options.topLevel : "";
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
                    if (typeof (obj[o]) == "object") {
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
        if (typeof title == "string") {
            xw.writeAttribute("name", title);
        } else {
            if(!topLevelElementDefined && businessObjectName != ""){
                xw.writeAttribute("name", businessObjectName);
                topLevelElementDefined = true;
            }
        }
    }

    function setElementTypeAndAttributes(obj, key) {
        var type = jpath.value(obj, "$.type");

        xw.startElement("xs:element");
        if (typeof key == "string") {
            xw.writeAttribute("name", key);
        }
        //set nil attributes if any
        if (type instanceof Array) {
            for (var t in type) {
                if ("null" === type[t]) {
                    xw.writeAttribute("nillable", "true");
                    break;
                }
            }
        }
        setRestrictions(obj);        
        xw.endElement(); // element closing tag      
    }

    function setElementAttribute(value, attrib) {
        var val = jpath.value(JSONSchemaKeywordsXSDMappings, "$.types." + value);
        xw.writeAttribute(attrib, (typeof val == "string") ? val : "");
    }

    function setRestrictions(obj){
        type = determineType(obj);
        //set restrictions if any
        if (typeof obj == "object") {
            var filteredObj, xsdkey, value = type;
            var format = jpath.value(obj, "$.format");
            var description = jpath.value(obj, "$.description");
            if(typeof description == "string"){
                xw.writeComment(description);
            }

            var disregard = [];
            if (typeof type == "string" && type == "integer"){
                var minimum = jpath.value(obj, "$.minimum");
                var exclusiveMinimum = jpath.value(obj, "$.exclusiveMinimum");
                var maximum = jpath.value(obj, "$.maximum");
                var exclusiveMaximum = jpath.value(obj, "$.exclusiveMaximum");
                
                if(typeof minimum == "number" && minimum == 0 && typeof exclusiveMinimum == "boolean" && exclusiveMinimum){
                    value = "positiveInteger";
                    disregard.push("minimum");
                    disregard.push("exclusiveMinimum");                    
                } else if(typeof minimum == "number" && minimum == 0 && typeof exclusiveMinimum == "boolean" && !exclusiveMinimum){
                    value = "nonPositiveInteger";
                    disregard.push("minimum");
                    disregard.push("exclusiveMinimum");               
                } else if(typeof maximum == "number" && maximum == 0 && typeof exclusiveMaximum == "boolean" && exclusiveMaximum){
                    value = "negativeInteger";        
                    disregard.push("maximum");
                    disregard.push("exclusiveMaximum");             
                } else if(typeof maximum == "number" && maximum == 0 && typeof exclusiveMaximum == "boolean" && !exclusiveMaximum){
                    value = "nonNegativeInteger"; 
                    disregard.push("maximum");
                    disregard.push("exclusiveMaximum");                      
                }
            }

            if ((filteredObj = filterObjectKeys(obj, JSONSchemaKeywords[type], disregard)).length > 0) {
                xw.startElement("xs:simpleType");
                xw.startElement("xs:restriction");

                if (typeof format == "string") {
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
                            if (typeof xsdkey == "string") {
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
                setElementAttribute(value, "type");
            }
        }
    }

    function determineType(obj) {
        //determine object type as specified if any
        var type = jpath.value(obj, "$.type") || "";
        if (type instanceof Array && type.length > 0 && typeof type[0] == "string") {
            type = type[0];
        }
        return type;
    }

    function filterObjectKeys(obj, accepted, disregard) {
        var newObj = [], o;
        if (accepted != undefined) {
            for (var key in obj) {
                if (accepted.indexOf(key) > -1) {
                    var found=false;
                    for(var d in disregard){
                        if(disregard[d] == key){
                            found = true;
                            break;
                        }
                    }
                    if(!found){
                        o = new Object();
                        o[key] = obj[key];
                        newObj.push(o);
                    }
                }
            }
        }
        return newObj;
    }
}