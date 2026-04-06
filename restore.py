import json

path = '/home/hiejima/Desktop/MyReservationApp/build/resources/main/reservations/'
log = json.load(open(path + 'reservations-log.json'))

res = {}
for e in reversed(log):
    action = e.get('action', '')
    r = e.get('res')
    if not r:
        continue
    rid = r.get('id', '')
    if not rid:
        continue
    if action == 'delete':
        if rid not in res:
            res[rid] = None
    elif action in ('create', 'edit'):
        if rid not in res:
            res[rid] = r

result = [v for v in res.values() if v]
json.dump(result, open(path + 'reservations.json', 'w'), ensure_ascii=False, indent=2)
print('復元:', len(result), '件')
