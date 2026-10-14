const test=require('node:test');
const assert=require('node:assert/strict');
const {teams}=require('../cycle3-teams');
test('cycle three has twelve candidate experiments',()=>assert.equal(Object.keys(teams()).length,12));
