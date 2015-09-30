var validator = require('validator');

var util = require('util');

var actionToError = {
  'requireIt' : 'miss',
  'refuseIt'  : 'conflict',
  'checkIf'   : 'invalid'
};

function handleError(prop, action){
  this.hasErrors = true;
  this.errors.push(actionToError[action] + ':' + prop);
  return false;
}


function validate(payload, currentContext, callbacks){

  var instance = this;
  var schema = this.schema;

  var saveData = {};
  var auxData  = {};

  validateProperties(
    {
      properties: payload, 
      context:    currentContext, 
      breadcrumb: [], 
      schema:     schema, 
      instance:   instance, 
      saveData:   saveData, 
      auxData:    auxData
    }
  );

  // returning all the errors if any...
  if(instance.hasErrors){
    return callbacks.onError(instance.errors);
  } 

  // or returning the correct data to be saved
  return callbacks.onSuccess(saveData, auxData);
}


function validateProperties(args){

  var properties = args.properties;
  var context    = args.context;
  var breadcrumb = args.breadcrumb;
  var schema     = args.schema; 
  var instance   = args.instance;
  var saveData   = args.saveData; 
  var auxData    = args.auxData;

  for(var currItemKey in schema){

    breadcrumb.push(currItemKey);
    var breadcrumbCopy = breadcrumb.slice(0);
    breadcrumb.pop();
    
    var validProperty = validateProperty(
      {
        key:          currItemKey, 
        value:        properties[currItemKey], 
        schema:       schema[currItemKey], 
        siblingItems: properties, 
        globalObject: properties, 
        context:      context, 
        breadcrumb:   breadcrumbCopy, 
        instance:     instance, 
        saveData:     saveData, 
        auxData:      auxData
      }
    );

    // exiting validation if we have error and we want to exit on first error
    if(!validProperty)
      if(instance.exitOnFirstError) return false;

    if(validProperty.value != undefined)
      if(validProperty.saveIt)
        saveData[currItemKey] = validProperty.value;
      else
        auxData[currItemKey]  = validProperty.value;
  }
}

function validateProperty(args){

  var key          = args.key;
  var value        = args.value;
  var schema       = args.schema;
  var siblingItems = args.siblingItems;
  var globalObject = args.globalObject;
  var context      = args.context;
  var breadcrumb   = args.breadcrumb;
  var instance     = args.instance;
  var saveData     = args.saveData; 
  var auxData      = args.auxData;

  var breadcrumbTxt = breadcrumb.join('.');

  console.log('------------------------ [ ' + breadcrumbTxt + ' ]');
  console.log('data: ', value);

  // ---------------------------------------------- requireIt ----------------------------------------------

  if(must('requireIt', schema, key, value, context, globalObject)){
    console.log('[x] requireIt');
    if(!payloadHasItem(siblingItems, key)){
      return instance.handleError(breadcrumbTxt, 'requireIt');
    }
  } else {
    //
    console.log('[ ] requireIt');
  }

  // ---------------------------------------------- refuseIt ----------------------------------------------

  if(schema.hasOwnProperty('refuseIt')){
    // check if item must be refused
    if(must('refuseIt', schema, key, value, context, globalObject)){
      console.log('[x] refuseIt');
      if(payloadHasItem(siblingItems, key)){
        return instance.handleError(breadcrumbTxt, 'refuseIt');
      }
    } else {
      console.log('[ ] refuseIt');
    }
  } else {
    //
    console.log('[ ] refuseIt');
  }

  // ---------------------------------------------- checkIf ----------------------------------------------

  if(schema.hasOwnProperty('checkIf')){
    if(isArray(schema.checkIf)) {
      if(!analyzeMultipleConditions(schema.checkIf, key, value, 'checkIf', context, globalObject)){
        return instance.handleError(breadcrumbTxt, 'checkIf');
      }
    } else if(!analyzeOneCondition(schema.checkIf, key, value, 'checkIf', context, globalObject)){
      return instance.handleError(breadcrumbTxt, 'checkIf');
    }
  }

  var isNestedArray = false, validatedArray = [];

  // ---------------------------------------------- type ----------------------------------------------

  if(schema.hasOwnProperty('type')){
    if(schema.type == 'array'){

      // iterates through the array items
      var validValues = [];
      for(var i in value){

        var validNestedSet = validateNestedSet(
          {
            properties:   value[i], 
            globalObject: globalObject, 
            context:      context, 
            breadcrumb:   breadcrumb, 
            schema:       schema.itemsProperties, 
            instance:     instance, 
            saveData:     saveData, 
            auxData:      auxData
          }
        );

        if(!validNestedSet) return false;

        validValues[i] = validNestedSet;

      }
      
    } else if(schema.type == 'object'){
      var validValues = validateNestedSet(
        {
          properties:   value, 
          globalObject: globalObject, 
          context:      context, 
          breadcrumb:   breadcrumb, 
          schema:       schema.properties, 
          instance:     instance, 
          saveData:     saveData, 
          auxData:      auxData
        }
      );
      if(!validValues) return false;
    }

    var saveIt = must('saveIt', schema, key, value, context, globalObject);

    return {
      saveIt: saveIt,
      value:  validValues
    };

  }
    
  // ---------------------------------------------- saveIt ----------------------------------------------

  var saveIt = must('saveIt', schema, key, value, context, globalObject);

  return {
    saveIt: saveIt,
    value:  value
  };

}

function validateNestedSet(args){

  var properties   = args.properties;
  var globalObject = args.globalObject;
  var context      = args.context;
  var breadcrumb   = args.breadcrumb;
  var schema       = args.schema; 
  var instance     = args.instance;
  var saveData     = args.saveData; 
  var auxData      = args.auxData;

  console.log('------------------------------------------------------------------------------------ NESTED SET');
  //console.log(args); 

  var validSet = {};

  var nestedHasError = false;
  for(var currItemKey in schema){

    console.log('analyze:' + currItemKey);

    breadcrumb.push(currItemKey);
    var breadcrumbCopy = breadcrumb.slice(0);
    breadcrumb.pop();
    
    var validProperty = validateProperty(
      {
        key:          currItemKey, 
        value:        properties[currItemKey], 
        schema:       schema[currItemKey], 
        siblingItems: properties, 
        globalObject: globalObject, 
        context:      context, 
        breadcrumb:   breadcrumbCopy, 
        instance:     instance, 
        saveData:     saveData, 
        auxData:      auxData
      }
    );

    // exiting validation if we have error and we want to exit on first error
    if(!validProperty)
      if(instance.exitOnFirstError) return false;

    if(validProperty.saveIt)
      if(validProperty.value != undefined)
        validSet[currItemKey] = validProperty.value;

  }
  //console.log('VALID SET: ', validSet);
  return validSet;
}

function isArray(val){
  //console.log('runnign isArray', val, Object.prototype.toString.call(val) );
  //console.log(util.inspect(val, false, null, true));
  return Object.prototype.toString.call(val) === "[object Array]";
}

function isString(val){
  return typeof val === "string";
}

function isObject(val){
  return typeof val === "object";
}

function payloadHasItem(payload, itemKey){
  if(payload.hasOwnProperty(itemKey)) {
    //console.log('payloadHasItem', itemKey, 'OK');
    return true;
  }
  return false;
}

function must(action, itemSchema, itemKey, itemValue, currentContext, payload){
  //console.log('analyzing must =>', action, ' for:', itemKey);
  //console.log('schema', itemSchema);

  // array = multiple conditions
  if(isArray(itemSchema)) return analyzeMultipleConditions(itemSchema, itemKey, itemValue, action, currentContext, payload);

  var _must = itemSchema[action];

  // no  property = always must
  if(!itemSchema.hasOwnProperty(action)) return true;

  // always 
  if(_must == 'always') return true;
  
  // never 
  if(_must == 'never') return false;

  // when is just a explicit redundant condition reference, so just get its content
  if(_must.hasOwnProperty('when')) {
    //console.log('when = recursive...');
    return must(action, _must.when, itemKey, itemValue, currentContext, payload);
  }

  //console.log('_must', _must);
  
  // some string as validator function call
  if(validator.hasOwnProperty(_must)) return validator[_must](itemValue);
  
  // object = one paramater condition
  if(typeof _must === 'object') {  
    // pass the object as a general one param condition
    return analyzeOneCondition(_must, itemKey, itemValue, action, currentContext, payload);
  }
  
  // no condition matching
  throw new Error('Invalid conditions for action "' + action + '" on property "' + itemKey + "'");
}

function analyzeOneCondition(condition, itemKey, itemValue, action, currentContext, payload){

  if(action == 'checkIf') return analyzeCheckIf(condition, itemKey, itemValue, currentContext, payload);

  //console.log('analyzing single condition for:', itemKey, " => ", condition);
  
  var objKeys = Object.keys(condition);
  var objKey = objKeys[0];

  switch(objKey){
    case 'contextIs': 
      return analyzeContextIs(condition.contextIs, itemKey, itemValue, action, currentContext, payload);
      break;
    case 'payloadHas':
      return analyzePayloadHas(condition.payloadHas, itemKey, itemValue, action, currentContext, payload);
      break;
    default:
      throw new Error('Invalid conditions for action "' + action + '" on property "' + itemKey + "'");
  }
}

function analyzeMultipleConditions(conditions, itemKey, itemValue, action, currentContext, payload){
  //console.log('analyzing multiple conditions for ' + action);
  var intermediateResult;
  var len = conditions.length;
  for(var i = 0; i < len; i += 2){
    var currArrayItem = conditions[i];
    if(i > 0){
      var logic = conditions[i-1];
      if(logic == "AND"){
        //console.log("AND");
        intermediateResult = intermediateResult && analyzeOneCondition(currArrayItem, itemKey, itemValue, action, currentContext, payload);
      } else if(logic == "OR"){
        //console.log("OR");
        intermediateResult = intermediateResult || analyzeOneCondition(currArrayItem, itemKey, itemValue, action, currentContext, payload);
      } else {
        throw new Error("Invalid login item in array condition. Must be AND or OR");
      }
    } else {
      intermediateResult = analyzeOneCondition(currArrayItem, itemKey, itemValue, action, currentContext);
    }
  }
  return intermediateResult;
}

function analyzeContextIs(contextIs, itemKey, itemValue, action, currentContext, payload){
  //console.log('analyzing [contextIs] (' + contextIs + ' == ' + currentContext + ') conditions for:', itemKey);
  if(contextIs == currentContext) return true;
  if(isArray(contextIs)){
    for(var i in contextIs){
      if(contextIs[i] == currentContext){
        //console.log('context ok!!!!!........');
        return true;
      }
    }
  }
  return false;
}

function analyzePayloadHas(payloadHas, itemKey, itemValue, action, currentContext, payload){
  //console.log('analyzing [payloadHas] (' + payloadHas + ') condition related to:', itemKey);
  // simple string
  if(typeof payloadHas === 'string') {

    return payloadHasItem(payload, itemKey);
  }
  // object 
  var objKeys = Object.keys(payloadHas);
  var property = objKeys[0];
  if(payloadHas[property] == payload[property]){
    //console.log('payloadHas', payloadHas, 'OK');
    return true;
  }
}

function analyzeCheckIf(condition, itemKey, itemValue, action, currentContext, payload){
  //console.log('analyze checkIf de ', itemKey, 'condition: ', condition);
  if(isObject(condition)){
    var objKeys = Object.keys(condition);
    var objKey = objKeys[0];
    return validator[objKeys].apply(null, [ itemValue, condition[objKey] ]);
  }
  return validator[condition](itemValue);
}

validator.extend('isArray', function (str) {
  return isArray(str);
});

validator.extend('isObject', function (str) {
  return isObject(str);
});

validator.extend('isString', function (str) {
  return isString(str);
});

function useSchema(schema){

  var smartValidatorObj = {
    schema: schema,
    validate: validate,
    handleError: handleError,
    hasErrors: false,
    errors: [],
    validator: validator,
    exitOnFirstError: true,
  };

  return smartValidatorObj;
}

var SmartValidator = {
  useSchema: useSchema
};

module.exports = SmartValidator;