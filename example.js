var contextualSchemaValidator = require('./index.js');

var util = require('util');

var productSchema = {

  id: {
    checkIf: 'isInt',
    requireIt: {
      when: {
        contextIs: ['updateProduct', 'deleteProduct']
      }
    },
    defaults: {
      'addProduct': function() { return new Date().getTime(); }
    }
  },

  name: {
    requireIt: {
      when: {
        contextIs: 'addProduct'
      }
    },
    checkIf: [
      'isString',
      'AND',
      { 'isLength': [3, 20] }
    ],
    saveIt: 'always',
    sanitizeIt: [
      { 'ltrim': [['x']] },
      { 'rtrim': [['y', 'z']] },
      'trim'
    ]
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
      'fromArrayToMap': { mapKeyField : 'id'}
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
        checkIf: 'isInt',
        defaults: {
          'addProduct': 888
        }
      },
      carbohydrates: {
        requireIt: 'never',
        checkIf: 'isInt'
      }
    },
    saveIt: 'always'
  }

};

var contextualSchemaValidator = require('./index.js');

var util = require('util');

var productValidator = contextualSchemaValidator.useSchema(productSchema);

productValidator.exitOnFirstError = false; 

console.log('----- addProduct -----');

var productPayload = {
  // id: 1,
  name: 'x Spaghetti yz',
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

productValidator.validate(
  productPayload,  // the data
  'addProduct', // the context
  {
    onError: function(errors){
      console.error('[ ERRORS ] ', errors);
    },
    onSuccess: function(saveData, auxData){
      console.log(' [ SAVE_DATA ] ');
      console.log(util.inspect(saveData, false, null, true));
      console.log(' [ AUX_DATA ] ');
      console.log(util.inspect(auxData, false, null, true));
    }
  }
);

console.log('----- deleteProduct -----');

var productPayload = {
  id: 1,
  iShallNotBeHere: 'But i am here'
};

productValidator.validate(
  productPayload,  // the data
  'deleteProduct', // the context
  {
    onError: function(errors){
      console.error('[ ERRORS ] ', errors);
    },
    onSuccess: function(saveData, auxData){
      console.log(' [ SAVE_DATA ] ');
      console.log(util.inspect(saveData, false, null, true));
      console.log(' [ AUX_DATA ] ');
      console.log(util.inspect(auxData, false, null, true));
    }
  }
);