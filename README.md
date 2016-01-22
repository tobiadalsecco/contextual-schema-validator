# Contextual Schema Validator

EARLY ALPHA STAGE, DON'T USE IT IN PRODUCTION!

Validates JSON objects against a (JSON) schema which hallows you to trim specifics validations depending of specific contexts or object values.

Uses [validator](https://www.npmjs.com/package/validator) to validate data.

## The idea

Writing validations can be an expensive task. Howere, there are a lots of good modules to help. But sometimes, you have to rewrite a validation for the same field several times, in differents services (or areas of an application), or even in the same piece of code. 
Let's take a simple product CRUD as an example: you may want the product ID to be required, but only at updating some information. This simple exception prevents you to write a single validation model. 
The Contextual Schema Validator allows you to set validations behaviors in a declarative and (if needed) centralized way. You can trim a certain validation only in a specific context or when the validated object has some values.
You can also define which properties are to be saved and which are just 'auxiliary' data.

## How to use

### Example object: product

```javascript

var productPayload = {
  id: 1,
  name: 'Spaghetti',
  category: 'Food',
  tags: [
    { id: 1, name: 'Italian', iShallNotBeHere: 'But i am here'},
    { id: 2, name: 'Pasta' }
  ],
  nutritionFacts: {
    sodium: 1,
    carbohydrates: 100,
    iShallNotBeHere: 'But i am here'
  },
  iShallNotBeHere: 'But i am here'
};

```

### Writing a schema

```javascript

var productSchema = {

  id: {
    checkIf: 'isInt',
    requireIt: {
      when: {
        contextIs: ['updateProduct', 'deleteProduct']
      }
    },
    defaults: {
      'addProduct': function() { return someID(); }
    }
  },

  name: {
    requireIt: {
      when: {
        contextIs: 'addProduct'
      }
    },
    checkIf: [
      'isAlpha',
      'AND',
      { 'isLength': [3, 20] }
    ],
    saveIt: 'always'
  },

  active: {
    requireIt: 'never',
    checkIf: 'isBoolean',
    defaults: {
      'addProduct': true,
      'deleteProduct': false
    }
  },

  category: {
    requireIt: {
      when: {
        contextIs: 'addProduct'
      }
    },
    checkIf: 'isAlpha',
    saveIt: {
      when: {
        contextIs: ['addProduct', 'updateProduct']
      }
    }
  },

  tags: {
    requireIt: 'never',
    type: 'array',
    itemsProperties: {
      id : {
        checkIf: 'isInt',
        saveIt: 'always'
      },
      name: {
        checkIf: 'isAlpha',
        saveIt: 'always'
      }
    },
    saveIt: 'always',
    remapIt: {
      fromArrayToMap: { 
        mapKeyField : 'id'
      }
    }
  },

  nutritionFacts: {
    requireIt: {
      when: [
        { contextIs: 'addProduct' },
        'AND',
        {
          payloadHas: {
            category: 'Food'
          }
        }
      ]
    },
    type: 'object',
    properties: {
      sodium: {
        requireIt: 'never',
        checkIf: 'isInt'
      },
      carbohydrates: {
        requireIt: 'never',
        checkIf: 'isInt'
      }
    },
    saveIt: 'always'
  }

};

```

### Do validation

```javascript

// load the module
var contextualSchemaValidator = require('contextual-schema-validator');

// set a validato instance whci will use our defined schema
var productValidator = contextualSchemaValidator.useSchema(productSchema);

// set if you want to exit on first error or validate everything
productValidator.exitOnFirstError = false; // default is true

//
productValidator.validate(
  productPayload,  // the data (JSON)
  'addProduct', // the context (string). Could be an event, a command, or just the name of the function in which this code is in
  {
    onError: function(errors){
      console.error('[ ERRORS ] ', errors);
    },
    onSuccess: function(saveData, auxData){
      console.log(' [ SAVE_DATA ] ');
      console.log(saveData); // You will probably save this data in a database or do something useful with it
      console.log(' [ AUX_DATA ] ');
      console.log(auxData); // this could be some metadata, or log data, or whatever you don't want to save
    }
  }
);
```

### Example Result without errors

The id property will be moved to auxData.
All the properties that are not in the schema will be stripped away, so the 'iShallNotBeHere' props will all go away.

```javascript

// saveData
{ 
  name: 'Spaghetti',
  category: 'Food',
  tags: [ 
    { id: 1, name: 'Italian' }, 
    { id: 2, name: 'Pasta' } 
  ],
  nutritionFacts: { 
    sodium: 1, 
    carbohydrates: 100 
  }
}

// auxData
{ id: 1 }

```

### Example result with errors

If the payload was:

```javascript

var productPayload = {
  id: 1,
  name: 'Spaghetti with a very very long long name', // max is set to 20 now, will trim error
  category: 'Food',
  tags: [
    { id: 1, name: 'Italian', iShallNotBeHere: 'But i am here'},
    { /* id: 2, */ name: 'Pasta' }
  ],
  nutritionFacts: {
    sodium: 'wrong-id',
    carbohydrates: 100,
    iShallNotBeHere: 'But i am here'
  },
  iShallNotBeHere: 'But i am here'
};

```

then the result will be an array like:

```javascript

[ 
  { type: 'invalid',  prop: 'name' },
  { type: 'required', prop: 'tags.id' },
  { type: 'invalid',  prop: 'nutritionFacts.sodium' } 
]

```


# Documentation

## Define the type of your property

You only have the 'type' property do to this. And you must set it only if the property is an object or an array.

### type

Defines if the property is a simple value, an array of objects or a simple object.

Possible values:

* 'object' : in this case you must set the 'properties' property, which accepts a nested schema object, with all the possible validations and conditions, just as the main level object.
* 'array': in this case you must set the 'itemsProperties', which accepts an array of nested schema objects, with all the possible validations and conditions, just as the main level object.

Disabled by default, if not set the property will be treated as a simple values (string, bool or whatever).

## Main validations actions

### requireIt

Defines if you property will be required.

Possible values:

* 'always'
* 'never'
* an object with the 'when' property

Default: 'always'.

### refuseIt

Same as required, but opposite action: the properties cannot be accepted. Useful for avoiding conflicts.

Possible values:

* 'always'
* 'never'
* an object with the 'when' property

Default: 'never'.

### checkIf

Defines data validation.

Possible values:

* A string with one of the [validator](https://www.npmjs.com/package/validator)'s method name (the ones with no arguments, besides the value, which is automatically passed). Example: 'isInt'
* An object with [validator](https://www.npmjs.com/package/validator)'s method name as the key and an array of arguments. Example: { isLength: [3, 20] }
* An array of multiple conditions for validation

Disabled by default.

### saveIt

Defines if the property will go into the first returned object, which you will probably save in some database, or if it will go into the second object, as auxiliary data.

Possible values:

* 'always'
* 'never'
* an object with the 'when' property

### defaults

An object that defines the defaults values of a property depending on the context. The object pattern is: 

```javascript
{
  'theContext': 'the value'
}
```

If the property is set in the payload, even if it has a default value for the current context, the original payload value will be kept, and the default will be ignored.

### sanitizeIt

Defines if the property will be sanitized by on of the [validator](https://www.npmjs.com/package/validator)'s methods.

Possible values:

* A string with one of the [validator](https://www.npmjs.com/package/validator)'s method name (the ones with no arguments, besides the value, which is automatically passed). Example: 'escape'
* An object with [validator](https://www.npmjs.com/package/validator)'s method name as the key and an array of arguments. Example: { ltrim: [['s', '.']] }
* An array with one of the above values as items

### remapIt

Defines some aditional operation on the valid value. Accepts an object with the remap type as key and an object of configurations.

#### remapIt Types

Currently supports only the 'fromArrayToMap' type.

##### fromArrayToMap

Transform an array of objects into a map (object), with each array item mapped by the chosen item key. For example, given the value:

```javascript
[
  { id: 1, name: 'Italian' }, 
  { id: 2, name: 'Pasta' } 
]
```

and the remaptIt configuration:

```javascript
remapIt: {
  fromArrayToMap: { 
    mapKeyField : 'id'
  }
}
```

the value will be remapped this way:

```javascript
{ 
  '1': { id: 1, name: 'Italian' },
  '2': { id: 2, name: 'Pasta' } 
}
```

### The 'when' object

Defines if 3 of the 4 main validation (requireIt, refuseIt, saveIt) should be triggered.

Possible values:

* An object with one Simple Condition
* An array of Multiple Conditions

## Simple Conditions

### contextIs

Defines the context in which some action should take place. The context will be matched against the second argument of the main validate() function.

Possible values:

* A string with the context name
* An array of strings. The context should be match one of them (like an 'OR' logical operator)

### contextIsNot

Same as contextIs, but opposite result.

### payloadHas

Defines a condition in which if the payload (the validated object) has a property with a certain values, the action should take place.

Possible values:

* an object with the property key as the key, and the value as the value.

Works only with main level's properties (who knows, in the future...)

## Array of Multiple Conditions

The 'when' and 'checkIf' operators accept multiple conditions, as an array.

The general structure of the Multiple Conditions Array must be an alternation of Simple Conditions (or 'checkIf' values) and logical Operators, like this:

[ ConditionOrValidation, LogicalOperator, ConditionOrValidation, LogicalOperator, ...]

### Logical Operators

Possible values:

* 'AND'
* 'OR'