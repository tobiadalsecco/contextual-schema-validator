var validator = require('validator');

var actionToError = {
  'requireIt' : 'required',
  'refuseIt'  : 'refused',
  'checkIf'   : 'invalid'
};

function handleError(prop, action, value, globalObject){
  this.hasErrors = true;
  var error = { type: actionToError[action], prop: prop };
  if(value){
    error.value = value;
  }
  if(globalObject){
    error.globalObject = globalObject;
  }
  this.errors.push(error);
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

    if(validProperty.value != undefined){

      var returnedVal = remapIt(schema[currItemKey], validProperty.value);

      if(validProperty.saveIt){
        saveData[currItemKey] = returnedVal;
      } else {
        auxData[currItemKey]  = returnedVal;
      }
    }

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

  //console.log('------------------------ [ ' + breadcrumbTxt + ' ]');
  //console.log('data: ', value);

  // ---------------------------------------------- requireIt ----------------------------------------------
  var _mustRequire = false;
  if(must('requireIt', schema, key, value, context, globalObject)){
    //console.log('[x] requireIt');
    _mustRequire = true;
    if(!payloadHasItem(siblingItems, key)){
      return instance.handleError(breadcrumbTxt, 'requireIt');
    }
  } else {
    //
    //console.log('[ ] requireIt');
    if(value == undefined){
      if(schema.hasOwnProperty('defaults')){
        if(schema.defaults.hasOwnProperty(context)){
          if(typeof schema.defaults[context] == 'function'){
            value = schema.defaults[context]();
          } else {
            value = schema.defaults[context];
          }
        }
      } else if(schema.hasOwnProperty('default')){
        if(typeof schema.default == 'function'){
          value = schema.default();
        } else {
          value = schema.default;
        }
      } else {
        return { saveIt: false };
      }
    } 
  }

  //console.log('passou required');

  // ---------------------------------------------- refuseIt ----------------------------------------------

  if(schema.hasOwnProperty('refuseIt')){
    // check if item must be refused
    if(must('refuseIt', schema, key, value, context, globalObject)){
      ////console.log('[x] refuseIt');
      if(payloadHasItem(siblingItems, key)){
        return instance.handleError(breadcrumbTxt, 'refuseIt');
      }
    } else {
      ////console.log('[ ] refuseIt');
    }
  } else {
    //
    ////console.log('[ ] refuseIt');
  }

  //console.log('passou refuse');

  // ---------------------------------------------- checkIf ----------------------------------------------

  if(schema.hasOwnProperty('checkIf')){
    if(isArray(schema.checkIf)) {
      if(!analyzeMultipleConditions(schema.checkIf, key, value, 'checkIf', context, globalObject)) {
        return instance.handleError(breadcrumbTxt, 'checkIf', value, JSON.stringify(globalObject));
      }
    } else if(!analyzeOneCondition(schema.checkIf, key, value, 'checkIf', context, globalObject)) {
      return instance.handleError(breadcrumbTxt, 'checkIf', value, JSON.stringify(globalObject));
    }
  }

  //console.log('passou checkIf');

  var isNestedArray = false, validatedArray = [];

  // ---------------------------------------------- type ----------------------------------------------

  if(value != undefined && schema.hasOwnProperty('type')){
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

    //console.log('passou type / nested');

   
    var saveIt = must('saveIt', schema, key, value, context, globalObject);
    

    return {
      saveIt: saveIt,
      value:  validValues
    };
  }
  


  // ---------------------------------------------- saveIt ----------------------------------------------

  var saveIt = must('saveIt', schema, key, value, context, globalObject);



  // ---------------------------------------------- sanitizeIt ----------------------------------------------

  if(schema.hasOwnProperty('sanitizeIt')){
    var sanitizer = schema.sanitizeIt;
    if(isArray(sanitizer)){
      for(var s in sanitizer){
        value = sanitize(sanitizer[s], value);
      }
    } else {
      value = sanitize(sanitizer, value);
    }
  }

  return {
    saveIt: saveIt,
    value:  value
  };

}

function sanitize(condition, itemValue){
  if(isObject(condition)){
    var objKeys = Object.keys(condition);
    var objKey = objKeys[0];
    var args = condition[objKey];
    args.unshift(itemValue);
    return validator[objKey].apply(null, args);
  }
  ////console.log(condition);
  return validator[condition](itemValue);
}

function remapIt(schema, value){
  
  if(schema.hasOwnProperty('remapIt')){
    var remapIt = schema.remapIt;
    if(isObject(remapIt)){
      var remapKeys = Object.keys(remapIt);
      var remapType = remapKeys[0];

      if(remapType == 'fromArrayToMap'){

        if(isArray(value)){
          var newMap = {};
          var mapKeyField = remapIt.fromArrayToMap.mapKeyField;
          var allowProperties = remapIt.fromArrayToMap.allowProperties;
          for(var i in value){
            var currVal = value[i];
            if(!allowProperties){
              newMap[value[i][mapKeyField]] = value[i];
            } else {
              var currBranch = newMap[value[i][mapKeyField]] = {};
              for(var p in allowProperties){
                var prop = allowProperties[p];
                currBranch[prop] = value[i][prop];
              }
            }
          }
          return newMap;
        }

      }

    }
  } else {
    return value;
  }
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

  ////console.log('------------------------------------------------------------------------------------ NESTED SET');
  //////console.log(args); 

  var validSet = {};

  var nestedHasError = false;
  for(var currItemKey in schema){

    //////console.log('analyze:' + currItemKey);

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
      if(validProperty.value != undefined){
        var returnedVal = remapIt(schema[currItemKey], validProperty.value);
        validSet[currItemKey] = returnedVal;
      }

  }
  //////console.log('VALID SET: ', validSet);
  return validSet;
}

function isArray(val){
  //////console.log('runnign isArray', val, Object.prototype.toString.call(val) );
  //////console.log(val);
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
    //////console.log('payloadHasItem', itemKey, 'OK');
    return true;
  }
  return false;
}

function must(action, itemSchema, itemKey, itemValue, currentContext, payload){
  ////console.log('analyzing must =>', action, ' for:', itemKey);
  ////console.log('schema', itemSchema);

  var _must = itemSchema[action];

  // no  property = always must
  if(!_must) return true;

  // always 
  if(_must == 'always') return true;
  
  // never 
  if(_must == 'never') return false;

  
  if(!isObject(_must)) throw new Error('Contextual Schema Validator Error: invalid condition for ' + action + ' (' + _must + ')');
  
  // when is a more complex condition
  if(_must.hasOwnProperty('when')) {
    ////console.log('when...');
    if(isArray(_must.when)){
      return analyzeMultipleConditions(_must.when, itemKey, itemValue, action, currentContext, payload);
    }
    return analyzeOneCondition(_must.when, itemKey, itemValue, action, currentContext, payload);
  } else {
    throw new Error('Contextual Schema Validator Error: invalid condition for ' + action + ' (' + _must + ')');
  }
  
  // no condition matching
  throw new Error('Invalid conditions for action "' + action + '" on property "' + itemKey + "'");
}

function analyzeOneCondition(condition, itemKey, itemValue, action, currentContext, payload){

  if(action == 'checkIf') return analyzeCheckIf(condition, itemKey, itemValue, currentContext, payload);

  //////console.log('analyzing single condition for:', itemKey, " => ", condition);
  
  var objKeys = Object.keys(condition);
  var objKey = objKeys[0];

  switch(objKey){
    case 'contextIs': 
      return analyzeContextIs(condition.contextIs, itemKey, itemValue, action, currentContext, payload);
      break;
    case 'contextIsNot': 
      return analyzeContextIsNot(condition.contextIsNot, itemKey, itemValue, action, currentContext, payload);
      break;
    case 'payloadHas':
      return analyzePayloadHas(condition.payloadHas, itemKey, itemValue, action, currentContext, payload);
      break;
    default:
      throw new Error('Invalid conditions for action "' + action + '" on property "' + itemKey + "'");
  }
}

function analyzeMultipleConditions(conditions, itemKey, itemValue, action, currentContext, payload){
  //////console.log('analyzing multiple conditions for ' + action);
  var intermediateResult;
  var len = conditions.length;
  for(var i = 0; i < len; i += 2){
    var currArrayItem = conditions[i];
    if(i > 0){
      var logic = conditions[i-1];
      if(logic == "AND"){
        //////console.log("AND");
        intermediateResult = intermediateResult && analyzeOneCondition(currArrayItem, itemKey, itemValue, action, currentContext, payload);
      } else if(logic == "OR"){
        //////console.log("OR");
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
  //console.log('-- ARRAY');
  if(isArray(contextIs)){
    for(var i in contextIs){
      if(contextIs[i] == currentContext){
        //console.log('context ok!!!!!........');
        return true;
      }
    }
  }
  ////console.log('--- FALSE');
  return false;
}

function analyzeContextIsNot(contextIs, itemKey, itemValue, action, currentContext, payload){
  //console.log('contextIsNot');
  return !analyzeContextIs(contextIs, itemKey, itemValue, action, currentContext, payload);
}

function analyzePayloadHas(payloadHas, itemKey, itemValue, action, currentContext, payload){
  //////console.log('analyzing [payloadHas] (' + payloadHas + ') condition related to:', itemKey);
  // simple string
  if(typeof payloadHas === 'string') {

    return payloadHasItem(payload, itemKey);
  }
  // object 
  var objKeys = Object.keys(payloadHas);
  var property = objKeys[0];
  if(payloadHas[property] == payload[property]){
    //////console.log('payloadHas', payloadHas, 'OK');
    return true;
  }
}

function analyzeCheckIf(condition, itemKey, itemValue, action, currentContext, payload){
  //console.log('analyze checkIf de ', itemKey, 'condition: ', condition);
  if(isObject(condition)){
    var objKeys = Object.keys(condition);
    var objKey = objKeys[0];
    var args = condition[objKey].slice(0);
    args.unshift(itemValue);
    return validator[objKey].apply(null, args);
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