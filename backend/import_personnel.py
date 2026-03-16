"""
Script d'import du personnel depuis le fichier Excel ENR04599.
Execution : docker exec kalilab-backend python import_personnel.py
"""
import asyncio
import os
import uuid
from datetime import datetime
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEFAULT_PASSWORD = "Kalilab2024!"

USERS = [
    {"nom": "Brassinne", "prenom": "Laetitia", "email": "l.brassinne@cdle.be", "role": "BIOLOGISTE"},
    {"nom": "Cauchie", "prenom": "Mathieu", "email": "m.cauchie@cdle.be", "role": "BIOLOGISTE"},
    {"nom": "Hotton", "prenom": "Julie", "email": "j.hotton@cdle.be", "role": "BIOLOGISTE"},
    {"nom": "Jacobs", "prenom": "Julie", "email": "julie.jacobs@cdle.be", "role": "BIOLOGISTE"},
    {"nom": "Miller", "prenom": "Nathalie", "email": "n.miller@cdle.be", "role": "BIOLOGISTE"},
    {"nom": "Vanneste", "prenom": "Franck", "email": "f.vanneste@cdle.be", "role": "BIOLOGISTE"},
    {"nom": "Mairesse", "prenom": "Antoine", "email": "a.mairesse@cdle.be", "role": "BIOLOGISTE"},
    {"nom": "Ngougni Pokem", "prenom": "Perrin", "email": "p.ngougnipokem@europehospitals.be", "role": "BIOLOGISTE"},
    {"nom": "Huysman", "prenom": "Carine", "email": "c.huysman@cdle.be", "role": "QUALITICIEN"},
    {"nom": "Derycke", "prenom": "Helene", "email": "derycke.ln@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Ronsmans", "prenom": "Kelcey", "email": "k.ronsmans@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Daugimont", "prenom": "Emmanuel", "email": "mdaugimont@gmail.com", "role": "RESP_TECHNIQUE"},
    {"nom": "Boite", "prenom": "Gilles", "email": "gilles066@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "Debusschere", "prenom": "Marie", "email": "m.debusschere@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Dewals", "prenom": "Veronique", "email": "v.dewals@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Haroun", "prenom": "Amina", "email": "a.haroun@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Jeegers", "prenom": "Deborah", "email": "djeegers@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Magnus", "prenom": "Karine", "email": "k.magnus@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Ngabena", "prenom": "Estelle", "email": "ngabena@yahoo.fr", "role": "TECHNICIEN"},
    {"nom": "Riestra", "prenom": "Maite", "email": "m.riestra@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Sussmilch", "prenom": "Jennifer", "email": "jennifersussmilch@outlook.com", "role": "TECHNICIEN"},
    {"nom": "Van De Woestijne", "prenom": "Veronique", "email": "v.vandewoestijn@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Vercouter", "prenom": "Nathalie", "email": "n.vercouter@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Barbery", "prenom": "Adrienne", "email": "adriennebarbery01@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Binda", "prenom": "Angele", "email": "a.binda@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Bitugangando", "prenom": "Franck", "email": "bifranck@outlook.com", "role": "TECHNICIEN"},
    {"nom": "Bouche", "prenom": "Isabelle", "email": "ibouche@yahoo.com", "role": "TECHNICIEN"},
    {"nom": "El Hamli", "prenom": "Amal", "email": "amal.el.hamli@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Eslama", "prenom": "Nasira", "email": "n.eslama@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Fayali", "prenom": "Iman", "email": "i.fayali@europehospitals.be", "role": "TECHNICIEN"},
    {"nom": "Kockx", "prenom": "Veronique", "email": "v.kockx@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Nagoda-Nicklewicz", "prenom": "Eva", "email": "e.nagodaniklewicz@europehospitals.be", "role": "TECHNICIEN"},
    {"nom": "Roscail", "prenom": "Beatrice", "email": "b.roscail@europehospitals.be", "role": "TECHNICIEN"},
    {"nom": "Abdoulaye", "prenom": "Adama", "email": "manilleab@netcourrier.be", "role": "TECHNICIEN"},
    {"nom": "Abrak", "prenom": "Iman", "email": "iman.abrak@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "Atsakena", "prenom": "Benjamin", "email": "batsakena@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Belleville", "prenom": "Bruno", "email": "bruno.belleville@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Benabdelkrime", "prenom": "Nouh", "email": "nouh.ben@outlook.be", "role": "TECHNICIEN"},
    {"nom": "Bentatou", "prenom": "Zahra", "email": "bentatou_21@msn.com", "role": "TECHNICIEN"},
    {"nom": "Blauwaert", "prenom": "Nadege", "email": "n.blauwaert@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Canas Torres", "prenom": "Dorian", "email": "doriancanastorres@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Citti", "prenom": "Alessia", "email": "alessia.citti@hotmail.fr", "role": "TECHNICIEN"},
    {"nom": "Dahhou", "prenom": "Ghizlane", "email": "gdahhou24@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Damblon", "prenom": "Simon", "email": "simondamblon@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Darricades", "prenom": "Morgane", "email": "darricadesmorgane@yahoo.fr", "role": "TECHNICIEN"},
    {"nom": "De Sousa Marques", "prenom": "Sofia", "email": "s.desousamarques@europehospitals.be", "role": "TECHNICIEN"},
    {"nom": "Demaret", "prenom": "Benoit", "email": "bdemaret@skynet.be", "role": "TECHNICIEN"},
    {"nom": "Diaz de la Concha", "prenom": "Ana Belen", "email": "a.diaz@cdle.be", "role": "TECHNICIEN"},
    {"nom": "El Achab", "prenom": "Ikram", "email": "ikramelachab@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "El Houdifi", "prenom": "Mounate", "email": "m.elhoudifi@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Giambra", "prenom": "Elisa", "email": "elisa.giambra@icloud.com", "role": "TECHNICIEN"},
    {"nom": "Goutier", "prenom": "Sylvianne", "email": "s.goutier@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Guidotti-Pena", "prenom": "Isolde", "email": "isoldeguidotti66@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Gundes", "prenom": "Armen", "email": "armengundes@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "Hernandez", "prenom": "Pauline", "email": "h.pauline0702@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Jamaoui", "prenom": "Siham", "email": "jsiham@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "Joseph", "prenom": "Nicolas", "email": "n.joseph@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Kayisire", "prenom": "Celine", "email": "c.kayisire@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Mahfad", "prenom": "Amina", "email": "amina.mahfad@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Maton", "prenom": "Agnes", "email": "agnes.maton@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "Musoni", "prenom": "Lambert", "email": "musonil@yahoo.fr", "role": "TECHNICIEN"},
    {"nom": "Muyldermans", "prenom": "Axel", "email": "axelmuyldermans@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "Nae", "prenom": "Luminita", "email": "nae.luminita@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Natis", "prenom": "Valerie", "email": "natis_valerie@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "Paquet", "prenom": "Florence", "email": "f.paquet@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Senna", "prenom": "Tabata", "email": "t.senna@europehospitals.be", "role": "TECHNICIEN"},
    {"nom": "Serroukh", "prenom": "Lamia", "email": "l.serroukh@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Stuckmann", "prenom": "Charlotte", "email": "c.stuckmann@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Swerts", "prenom": "Joel", "email": "j.swerts@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Vanleemputten", "prenom": "Justine", "email": "j.vanleemputten@hotmail.fr", "role": "TECHNICIEN"},
    {"nom": "Verwerft", "prenom": "Edouard", "email": "ed.verwerft@hotmail.com", "role": "TECHNICIEN"},
    {"nom": "Visschers", "prenom": "Lucie", "email": "l.visschers@cdle.be", "role": "TECHNICIEN"},
    {"nom": "Zaaboul", "prenom": "Basma", "email": "basma.bo.zz@gmail.com", "role": "TECHNICIEN"},
    {"nom": "Zubani", "prenom": "Yves", "email": "yveszubani@voo.be", "role": "TECHNICIEN"},
]


async def import_users():
    url = os.getenv("DATABASE_URL", "")
    engine = create_async_engine(url, echo=False)
    created = 0
    skipped = 0

    async with engine.begin() as conn:
        for u in USERS:
            r = await conn.execute(text("SELECT id FROM users WHERE email=:e"), {"e": u["email"]})
            if r.fetchone():
                print(f"  [SKIP] {u['prenom']} {u['nom']} — déjà existant")
                skipped += 1
                continue
            hpw = pwd_ctx.hash(DEFAULT_PASSWORD)
            uid = str(uuid.uuid4())
            now = datetime.utcnow()
            await conn.execute(text("""
                INSERT INTO users (uuid, nom, prenom, email, hashed_password, role, is_active, created_at, updated_at)
                VALUES (:uuid, :nom, :prenom, :email, :hpw, :role, true, :now, :now)
            """), {"uuid": uid, "nom": u["nom"], "prenom": u["prenom"],
                   "email": u["email"], "hpw": hpw, "role": u["role"], "now": now})
            print(f"  [OK] {u['prenom']} {u['nom']} | {u['role']}")
            created += 1

    await engine.dispose()
    print(f"\n=== {created} utilisateurs créés, {skipped} ignorés ===")
    print(f"Mot de passe par défaut : {DEFAULT_PASSWORD}")


asyncio.run(import_users())
