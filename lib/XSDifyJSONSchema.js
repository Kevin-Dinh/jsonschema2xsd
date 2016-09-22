var XMLWriter = require('xml-writer');
var pd = require('pretty-data').pd;
var _ = require('lodash');

var JSONSchemaKeywords={
    types:["string","array","object","number","integer","boolean","null"],
    number:["maximum","minimum","exclusiveMaximum","exclusiveMinimum","multipleOf"],
    integer:["maximum","minimum","exclusiveMaximum","exclusiveMinimum","multipleOf"],
    string:["maxLength","minLength","pattern","format","formatMaximum","formatMinimum","formatExclusiveMaximum","formatExclusiveMinimum"],
    array:["maxItems","minItems","uniqueItems","items","additionalItems","contains"],
    object:["required","properties","patternProperties","additionalProperties","maxProperties","minProperties","dependencies","patternGroups","patternRequired"],
    common:["enum","constant","not","oneOf","anyOf","allOf","switch"]
};

var JSONSchemaKeywordsXSDMappings={
    string:{
        maxLength:"maxLength",minLength:"minLength",pattern:"pattern",
        format:{
            "date-time":"dateTime",date:"date",time:"time"
        },formatMaximum:"formatMaximum",formatMinimum:"formatMinimum",formatExclusiveMaximum:"formatExclusiveMaximum",formatExclusiveMinimum:"formatExclusiveMinimum"
    },
    number:{maximum:"maxInclusive",minimum:"minInclusive"},
    integer:{maximum:"maxInclusive",minimum:"minInclusive"},
    types:{string:"xs:string",number:"xs:integer",integer:"xs:integer",positiveInteger:"xs:positiveInteger",nonPositiveInteger:"xs:nonPositiveInteger",negativeInteger:"xs:negativeInteger",nonNegativeInteger:"xs:nonNegativeInteger",boolean:"xs:boolean",dateTime:"xs:dateTime",date:"xs:date",time:"xs:time"}
};

var xw = new XMLWriter;
var businessObjectName;
var topLevelElementDefined = false;

module.exports = function (jsonData, options) {

    xw.startDocument()
        .writeAttribute("encoding", "UTF-8")
        .startElement("xs:schema");

    if (options && typeof options.targetNamespace == "string") {
        xw.writeAttribute("targetNamespace", options.targetNamespace);
    }
    if (options && typeof options.xmlNamespace == "string") {
        xw.writeAttribute("xmlns:xs", options.xmlNamespace);
    } else {
        xw.writeAttribute("xmlns:xs", "http://www.w3.org/2001/XMLSchema");
    }
    if (options && typeof options.elementFormDefault == "string") {
        xw.writeAttribute("elementFormDefault", options.elementFormDefault);
    }
    //business object name. Top Level (Top Level Global Element name)
    businessObjectName = (options && typeof options.topLevel == "string") ? options.topLevel : "";
    processJSONData(jsonData);

    xw.endElement() //schema closing tag
        .endDocument();

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
                        setElementTypeAndAttributes(obj, key, type);
                        break;
                }
            }
            else {
                // else traverse and process child objects
                _.each(obj, function(o, k){
                    if(typeof o == "object"){
                        processJSONData(o, k);
                    }
                });
            }
        }
    }

    function processTypeObject(obj, key) {
        var properties = obj && obj["properties"];
        xw.startElement("xs:complexType");
        setTagNameAttribute(obj && obj["title"]);
        xw.startElement("xs:sequence");

        if (typeof properties == "object") {
            processJSONData(properties);
        }
        xw.endElement().endElement(); //sequence closing tag and complexType closing tag
    }

    function processTypeArray(obj, key) {
        xw.startElement("xs:element");
        setTagNameAttribute(key);
        _.each(obj, function(item){
            processJSONData(item);
        });
        xw.endElement(); //element closing tag
    }

    function setTagNameAttribute(value) {
        if (typeof value == "string") {
            xw.writeAttribute("name", value);
        } else {
            if (!topLevelElementDefined && businessObjectName != "") {
                xw.writeAttribute("name", businessObjectName);
                topLevelElementDefined = true;
            }
        }
    }

    function setElementTypeAndAttributes(obj, key, type) {
        var description = obj && obj["description"];
        if (typeof description === "string") {
            xw.writeComment(description);
        }
        xw.startElement("xs:element");
        if (typeof key == "string") {
            xw.writeAttribute("name", key);
        }
        //set nil attributes if any
        if (type instanceof Array) {
            _.each(type, function(t){
                if(t === "null"){
                    xw.writeAttribute("nillable", "true");
                    return false;
                }
            });
        }
        setRestrictions(obj, type);
        xw.endElement(); // element closing tag      
    }

    function setElementAttribute(value, attrib) {
        var val = JSONSchemaKeywordsXSDMappings["types"][value];
        xw.writeAttribute(attrib, (typeof val == "string") ? val : "");
    }

    function setRestrictions(obj, type) {
        //set restrictions if any
        if (typeof obj == "object") {
            var filteredObj, xsdkey, value = type;
            
            var disregard = [];
            if (_.isString(type) && type == "integer") {
                var minimum = _.isNumber(obj.minimum) && obj.minimum;
                var exclusiveMinimum = obj.exclusiveMinimum;
                var maximum = _.isNumber(obj.maximum) && obj.maximum;
                var exclusiveMaximum = obj.exclusiveMaximum;

                if (minimum === 0 && _.isBoolean(exclusiveMinimum)) {
                    value = (exclusiveMinimum) ? "positiveInteger" : "nonPositiveInteger";
                    disregard.push("minimum");
                    disregard.push("exclusiveMinimum");
                }                
                if (maximum === 0 && _.isBoolean(exclusiveMaximum)) {
                    value = (exclusiveMaximum) ? "negativeInteger" : "nonNegativeInteger";
                    disregard.push("maximum");
                    disregard.push("exclusiveMaximum");
                }
            }

            // get intersecting key for the given object in JSON Schema Keywords definition. Process only known keys
            // then do not include keys if define in disregard for it has been processed already.
            var filtered = _.difference(_.intersection(Object.keys(obj), JSONSchemaKeywords[type]), disregard)

            if (filtered.length > 0) {
                var format = obj && obj["format"];
                
                xw.startElement("xs:simpleType")
                  .startElement("xs:restriction");

                if (_.isString(format)) {
                    var dateformat = _.pick(JSONSchemaKeywordsXSDMappings.string.format, [format]);
                    value = (dateformat && dateformat[format]) ? dateformat[format] : value;
                }
                setElementAttribute(value, "base");

                for (var keys in filtered){
                    if(filtered[keys] !== "format"){
                        xsdkey = JSONSchemaKeywordsXSDMappings[type][filtered[keys]];
                        if(_.isString(xsdkey)){
                            xw.startElement("xs:" + xsdkey);
                            xw.writeAttribute("value", obj[filtered[keys]]);
                            xw.endElement();
                        }
                    }
                }

                xw.endElement() //restriction closing tag
                  .endElement(); //simpleType closing tag
            } else {
                setElementAttribute(value, "type");
            }
        }
    }

    function determineType(obj) {
        //pick object property type
        var t = _.pick(obj, "type"),
            type = "";
        if(_.isString(t.type)){
            type = t.type;
        } else if(_.isArray(t.type)){
            type = _.head(t.type);
        }
        return type;
    }
}