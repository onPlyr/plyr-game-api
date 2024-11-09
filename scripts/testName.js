const { faker } = require('@faker-js/faker');

const generateUsername = () => {
  const adjective = faker.word.adjective().toUpperCase();
  const noun = faker.word.noun().toUpperCase();
  const hexDigits = faker.string.hexadecimal({ length: 4, prefix: '' }).toUpperCase();
  return `IPP_${adjective}_${noun}_${hexDigits}`;
};

const generateUsername2 = () => {

  const hexDigits = faker.string.hexadecimal({ length: 4, prefix: '' }).toUpperCase();
  return faker.helpers.fake('IPP_{{person.firstName}}_{{person.lastName}}_').toUpperCase() + hexDigits.toUpperCase();
};

const generateUsername3 = () => {
  const hexDigits = faker.string.hexadecimal({ length: 4, prefix: '' }).toUpperCase();
  const animalTypes = ['bear', 'bird', 'cat', 'dog', 'fish', 'horse', 'lion', 'rabbit', 'snake'];
  
  let animalName;
  do {
    const randomAnimalType = faker.helpers.arrayElement(animalTypes);
    animalName = faker.animal[randomAnimalType]().toUpperCase().replace(/\s+/g, '_');
  } while (!/^[A-Z_]+$/.test(animalName));

  return `${animalName}_${hexDigits}`;
}

const generateUsername4 = () => {
  const hexDigits = faker.string.hexadecimal({ length: 4, prefix: '' }).toUpperCase();

  const generateParts = () => {
    const firstPart = faker.color.human().toUpperCase();
    const secondPart = faker.food.fruit().toUpperCase();
    return { firstPart, secondPart };
  };

  let firstPart, secondPart;
  do {
    ({ firstPart, secondPart } = generateParts());
  } while (!/^[A-Z_]+$/.test(`${firstPart}_${secondPart}`));

  const username = `${firstPart}_${secondPart}_${hexDigits}`.replace(/[\s-]+/g, '_');
  
  return username;
}

const randomUsername = (hexDigits) => {
  const generateParts = () => {
    const firstPart = faker.color.human().toLowerCase().replace(/[\s-]+/g, '_');
    const secondPart = faker.food.fruit().toLowerCase().replace(/[\s-]+/g, '_');
    return { firstPart, secondPart };
  };

  let firstPart, secondPart;
  do {
    ({ firstPart, secondPart } = generateParts());
  } while (!/^[a-z_]+$/.test(`${firstPart}_${secondPart}`));

  const username = `${firstPart}_${secondPart}_${hexDigits}`;
  return username;
}



const usernames = Array.from({ length: 20 }, randomUsername);

console.log(usernames.join(', '));
