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
        "format": "pattern",
        "formatMaximum": "formatMaximum",
        "formatMinimum": "formatMinimum",
        "formatExclusiveMaximum": "formatExclusiveMaximum",
        "formatExclusiveMinimum": "formatExclusiveMinimum"
    },
    "number": {
        "maximum":"maxInclusive",
        "minimum":"minInclusive"
    }
};

var JSONSchemaFormatXSDPatternized = {
    /*date-time. This SHOULD be a date in ISO 8601 format of YYYY-MM-DDThh:mm:ssZ in UTC time.  
     *This is the recommended form of date/timestamp.*/
    "date-time" : "^(?:[1-9]\d{3}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1\d|2[0-8])|(?:0[13-9]|1[0-2])-(?:29|30)|(?:0[13578]|1[02])-31)|(?:[1-9]\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:Z|[+-][01]\d:[0-5]\d)$", //http://stackoverflow.com/questions/28020805/regex-validate-correct-iso8601-date-string-with-time
    
    /*date. This SHOULD be a date in the format of YYYY-MM-DD.  It is	
      recommended that you use the "date-time" format instead of "date"	 		
      unless you need to transfer only the date part.*/
    "date" : "^\d{4}\-(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])$",    
    //

    /*time. This SHOULD be a time in the format of hh:mm:ss.  It is	
     *recommended that you use the "date-time" format instead of "time"	
     *unless you need to transfer only the time part.*/
    "time": "^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$" 
    //http://stackoverflow.com/questions/8318236/regex-pattern-for-hhmmss-time-string
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
        //check if object
        if (typeof obj == "object") {
            
            var type = determineType(obj);
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

    function determineType(obj){
        //determine object type as specified if any
        var type = jpath.value(obj, "$.type") || "";
        
        if (typeof type == "object"){
            var getFirst;
            for(var t in type){
                if(JSONSchemaKeywords.types.indexOf(type[t]) < 0){
                    throw Error('Undetermined type found in JSON Schema.\nValid values for type keyword are string or an array.\nIf it is an array MUST be strings and MUST be unique. String values MUST be one of the seven primitive types defined by core specification.');                    
                }
                if(getFirst === undefined && typeof type[t] == "string"){
                    getFirst = type[t];                    
                } 
            }
            type = getFirst;
        }

        return type;
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
    
    function setElementTypeAndAttributes(obj, key){
        var type = jpath.value(obj, "$.type");
        var elementtype;
        xw.startElement("xs:element");
        if (key != undefined) {
            xw.writeAttribute("name", key);
        }
        //set attributes if any
        if (type != undefined) {
            ;
            if(typeof type == "string"){
                xw.writeAttribute("type", type);
                elementtype = type;
            }
            else if(type instanceof Array){
                for(var t in type){
                    if(type[t] != "null"){
                        xw.writeAttribute("type", type[t]);
                        elementtype = type[t];
                    } else {
                        xw.writeAttribute("nillable", "true");
                    }
                }
            }
            else if(typeof type == "object"){
                processJSONData(type);
            }
        }
        
        //set restrictions if any
        if(typeof obj == "object"){
            var filteredObj, xsdkey, value; 
            if((filteredObj = filterObjectKeys(obj, JSONSchemaKeywords.string)).length > 0){
                xw.startElement("xs:simpleType");
                xw.startElement("xs:restriction");
                for(var item in filteredObj){
                    for(var jsonkey in filteredObj[item]){
                        xsdkey = jpath.value(JSONSchemaKeywordsXSDMappings, "$."+elementtype+"."+jsonkey);
                        if(xsdkey!=undefined){
                            xw.startElement("xs:"+xsdkey);
                            if(jsonkey === "format"){
                                for(var p in JSONSchemaFormatXSDPatternized){
                                    if(p == obj[jsonkey]){
                                        value = JSONSchemaFormatXSDPatternized[p];
                                        break;
                                    }
                                }
                            } else {
                                value = obj[jsonkey];
                            }
                            xw.writeAttribute("value", value);
                            xw.endElement();
                        }
                    }
                }
                xw.endElement(); //simpleType closing tag
                xw.endElement(); //restriction closing tag
            }
        }

        xw.endElement(); // element closing tag      
    }

    function filterObjectKeys(obj, accepted) {
        var newObj = [], o;
        for (var key in obj){
            if (accepted.indexOf(key) > -1){
                o = new Object();
                o[key] = obj[key];
                newObj.push(o);
            }
        }
        return newObj;
    }
}