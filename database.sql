CREATE TABLE people (
    id int(11) AUTO_INCREMENT,
    name varchar(255),
    surname varchar(255),
    mail varchar(255),
    phone varchar(255),
    street varchar(255),
    city varchar(255),
    PRIMARY KEY (id)
); 

INSERT INTO people(name, surname, mail, phone, street, city)
VALUES ("Pedro", "Garcia", "pedro@pedro.com", "677463523", "Si", "Barcelona"); 
/*Nom, Cognoms, Correu electrònic, Telèfon, Direcció, Ciutat*/

UPDATE people
SET name="Manuel", surname="Robles", mail="manuel@manuel", phone="677546754", street="si", city="Barcelona" 
WHERE id=1;