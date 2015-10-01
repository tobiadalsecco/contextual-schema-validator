var contextualSchemaValidator = require('./index.js');

var util = require('util');

/*
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
*/

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

var productSchema = {

  id: {
    checkIf: 'isInt',
    requireIt: {
      when: {
        contextIs: ['updateProduct', 'deleteProduct']
      }
    },
    saveIt: 'never'
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
    saveIt: 'always'
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

var contextualSchemaValidator = require('./index.js');

var util = require('util');

var productValidator = contextualSchemaValidator.useSchema(productSchema);

productValidator.exitOnFirstError = false; 

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