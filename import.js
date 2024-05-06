let processList = document.getElementById("activity");

const BOOLEANS = {
	'true': true,
	'yes': true,
	't': true,
	'y': true,
	'1': true,
	'V': true,
	'v': true,
	'כן': true,
	'false': false,
	'no': false,
	'f': false,
	'n': false,
	'0': false,
	'X': false,
	'x': false,
	'לא': false,
	'': false,
	null: false,
	undefined: false
}

let importAdjudicator = (tournamentData, r) => {
	r.institution = tournamentData.institutions?.[r.institution]?.url ?? null;
	r.adj_core = BOOLEANS[r.adj_core];
	r.institution_conflicts = [];
	r.team_conflicts = [];
	r.adjudicator_conflicts = [];
	r.base_score = r.score ?? 0;
	return r;
};


let importTeams = (tournamentData, r) => {
	let institution_conflicts = [r.speaker1_institution, r.speaker2_institution]
		.filter(x => x && x.length > 0)
		.map(x => { console.log(x)
			return tournamentData.institutions?.[x]?.url ?? null })
		.filter(x => x)
	let team = {
		institution: tournamentData.institutions?.[r.speaker1_institution]?.url ?? null,
		break_categories: [],
		institution_conflicts,
		reference: r.reference,

		speakers: [],
	};
	team.use_institution_prefix = false;

	let i = 1;
	while (r[`speaker${i}_name`]) {
		team.speakers.push({
			name: r[`speaker${i}_name`],
			email: r[`speaker${i}_email`],
			categories: []
		});
		i++;
	};
	return team;
};

let created = (key, value, dict) => (r) => {
	dict[key][r[value]] = r.url;
	let li = document.createElement("li");
	li.innerText = "Created " + r[value];
	processList.appendChild(li);
};

let insertFromCSV = (formData, tournamentData, file, value, cb) => {
	if (!file) {
		return;
	}
	tournamentData[file.name.slice(0, -4)] = {};
	Papa.parse(file, {
		header: true,
		dynamicTyping: true,
		skipEmptyLines: 'greedy',
		step: (r, parser) => {
			let { _method, _url, ...body } = cb(tournamentData, r.data);

			const url = _url ?? tournamentData.tournament + "/" + file.name.slice(0, -4);
			const method = _method ?? 'POST';

			fetch(url, {
				method,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Token ' + formData.get('api-token')
				},
				body: JSON.stringify(body),
			}).then(response => response.json())
				.then(created(file.name.slice(0, -4), value, tournamentData))
				.catch(error => console.error('Error:', error));
		}
	});
};

let fullImporter = async (data, tournamentData) => {
	let files = {};
	for (const file of data.getAll("csvs"))
		files[file.name.slice(0, -4)] = file;
	[
		['teams', 'reference', importTeams],
		['adjudicators', 'name', importAdjudicator]
	].forEach(t => {
		if (Array.isArray(t)) {
			insertFromCSV(data, tournamentData, files[t[0]], t[1], t[2]);
		}
	});
};

async function getRequest(url, data) {
	return new Promise(async (resolve, reject) => {
		let req = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Token ' + data.get('api-token')
			},
		})
		if (req.ok) {
			resolve(await req.json());
		}
		reject(new Error('fail'));
	})
}

let importTournament = async (data) => {
	const url = new URL(data.get('url'));
	// Test if tournament already exists
	const getRequest = await fetch(url.protocol + "//" + url.host + "/api/v1/tournaments/" + data.get('slug'), {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Token ' + data.get('api-token')
		},
	})
	if (getRequest.ok) {
		return (await getRequest.json()).url;
	}

	// Create tournament
	const createRequest = await fetch(url.protocol + "//" + url.host + "/api/v1/tournaments", {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Token ' + data.get('api-token')
		},
		body: JSON.stringify({
			'name': data.get('tournament'),
			'slug': data.get('slug'),
			'active': true
		})
	});
	return (await createRequest.json()).url;
};

document.querySelector("form").addEventListener("submit", async (e) => {
	e.preventDefault();

	let data = new FormData(document.querySelector("form"));
	let tournamentUrl = await importTournament(data);

	const url = new URL(data.get('url'));
	let institutionsData = await getRequest(`${url.protocol}//${url.host}/api/v1/institutions`, data);

	let r = {}
	institutionsData.forEach(institution => r[institution.name] = institution)
	let tournamentData = {
		'tournament': tournamentUrl,
		'institutions': r
	};
	console.log(tournamentData);
	await fullImporter(data, tournamentData);
});