<?php

require_once __DIR__ . '/StocrmClient.php';

class CustomerService {
    private $client;

    public function __construct() {
        $this->client = new StocrmClient();
    }

    /**
     * Поиск клиента (физлица по телефону или юрлица по ИНН)
     */
    public function findClient($identifier, $type = 'phys') {
        $identifier = trim((string)$identifier);
        if (empty($identifier)) {
            return null;
        }

        if ($type === 'legal') {
            return $this->searchLegalEntity($identifier);
        }

        return $this->searchPhysicalClient($identifier);
    }

    /**
     * Получение баланса кэшбэка по официальной вики STOCRM
     */
    public function getClientBalance($clientId) {
        $contactId = (int)$clientId;
        if ($contactId <= 0) {
            return 0;
        }

        try {
            $res = $this->client->post('/api/external/v1/cashback/get_cashback_balance', [
                'CONTACT_ID' => $contactId
            ]);

            if (!empty($res) && is_array($res)) {
                if (isset($res['BALANCE'])) {
                    return (int)$res['BALANCE'];
                }
                if (isset($res['RESPONSE']['BALANCE'])) {
                    return (int)$res['RESPONSE']['BALANCE'];
                }
            }
        } catch (Throwable $e) {
            $this->log("Get cashback balance error for CONTACT_ID {$contactId}: " . $e->getMessage());
        }

        return 0;
    }

    /**
     * Получение истории транзакций кэшбэка по вики STOCRM:
     * /api/external/v1/cashback/get_filtered_transactions
     */
    public function getCashbackTransactions($clientId) {
        $contactId = (int)$clientId;
        if ($contactId <= 0) {
            return [];
        }

        try {
            $res = $this->client->post('/api/external/v1/cashback/get_filtered_transactions', [
                'FILTER' => [
                    'CONTACT_ID' => $contactId
                ],
                'SORT' => [
                    'DATE_CREATE' => 'DESC'
                ],
                'PAGE' => 1,
                'LIMIT' => 100
            ]);

            $data = $res['RESPONSE']['DATA'] ?? $res['DATA'] ?? $res['RESPONSE'] ?? $res;
            if (is_array($data)) {
                $transactions = [];
                foreach ($data as $item) {
                    if (is_array($item) && isset($item['CASHBACK_TRANSACTION_ID'])) {
                        $transactions[] = [
                            'id' => $item['CASHBACK_TRANSACTION_ID'],
                            'direction' => $item['DIRECTION'] ?? 'IN',
                            'value' => (int)($item['VALUE'] ?? 0),
                            'reason' => $item['REASON'] ?? 'Операция по счёту',
                            'offer_id' => $item['OFFER_ID'] ?? null,
                            'expired' => $item['EXPIRED'] ?? 'N',
                            'date_create' => $item['DATE_CREATE'] ?? '',
                            'date_expire' => $item['DATE_EXPIRE'] ?? null
                        ];
                    }
                }
                if (!empty($transactions)) {
                    return $transactions;
                }
            }
        } catch (Throwable $e) {
            $this->log("Get cashback transactions error for CONTACT_ID {$contactId}: " . $e->getMessage());
        }

        return [];
    }

    /**
     * Поиск юридического лица / ИП по ИНН
     */
    private function searchLegalEntity($inn) {
        $cleanInn = preg_replace('/\D/', '', (string)$inn);
        if (strlen($cleanInn) < 10) {
            return null;
        }

        try {
            $res = $this->client->post('/api/external/v1/contractors/get_filtered', [
                'FILTER' => [
                    'INN' => $cleanInn
                ],
                'LIMIT' => 20
            ]);

            if (!empty($res['RESPONSE']['DATA']) && is_array($res['RESPONSE']['DATA'])) {
                foreach ($res['RESPONSE']['DATA'] as $item) {
                    if ($this->itemMatchesInn($item, $cleanInn)) {
                        return $this->formatContractor($item, $cleanInn);
                    }
                }
            }
        } catch (Throwable $e) {
            $this->log("Contractors INN search failed: " . $e->getMessage());
        }

        try {
            $res = $this->client->post('/api/external/v1/contacts/get_from_filter', [
                'FILTER' => [
                    'SEARCH' => $cleanInn
                ],
                'LIMIT' => 20
            ]);

            if (!empty($res['RESPONSE']['DATA']) && is_array($res['RESPONSE']['DATA'])) {
                foreach ($res['RESPONSE']['DATA'] as $item) {
                    if ($this->itemMatchesInn($item, $cleanInn)) {
                        return $this->formatContact($item, 'legal', $cleanInn);
                    }
                }
            }
        } catch (Throwable $e) {
            $this->log("Contacts SEARCH failed: " . $e->getMessage());
        }

        return null;
    }

    /**
     * Поиск физического лица по номеру телефона
     */
    private function searchPhysicalClient($phone) {
        $digits = preg_replace('/\D/', '', (string)$phone);
        if (strlen($digits) < 10) {
            return null;
        }

        $phone10 = substr($digits, -10);
        $variants = ['7' . $phone10, '8' . $phone10, $phone10, '+7' . $phone10];

        foreach ($variants as $variant) {
            try {
                $res = $this->client->post('/api/external/v1/contacts/get_from_filter', [
                    'FILTER' => [
                        'SEARCH' => $variant
                    ],
                    'LIMIT' => 10
                ]);

                if (!empty($res['RESPONSE']['DATA']) && is_array($res['RESPONSE']['DATA'])) {
                    foreach ($res['RESPONSE']['DATA'] as $item) {
                        if ($this->itemMatchesPhone($item, $phone10)) {
                            return $this->formatContact($item, 'phys');
                        }
                    }
                }
            } catch (Throwable $e) {
                $this->log("Phone search error for {$variant}: " . $e->getMessage());
            }
        }

        return null;
    }

    private function itemMatchesInn($item, $cleanInn) {
        if (!is_array($item)) {
            return false;
        }

        foreach (['INN', 'inn', 'Inn', 'requisite_inn'] as $key) {
            if (!empty($item[$key])) {
                if (preg_replace('/\D/', '', (string)$item[$key]) === $cleanInn) {
                    return true;
                }
            }
        }

        if (!empty($item['REQUISITES']) && is_array($item['REQUISITES'])) {
            foreach ($item['REQUISITES'] as $req) {
                if (is_array($req)) {
                    foreach (['INN', 'inn', 'VALUE', 'value'] as $rKey) {
                        if (!empty($req[$rKey])) {
                            if (preg_replace('/\D/', '', (string)$req[$rKey]) === $cleanInn) {
                                return true;
                            }
                        }
                    }
                }
            }
        }

        $encoded = json_encode($item, JSON_UNESCAPED_UNICODE);
        if ($encoded && strpos($encoded, $cleanInn) !== false) {
            return true;
        }

        return false;
    }

    private function itemMatchesPhone($item, $phone10) {
        if (!is_array($item)) {
            return false;
        }

        $fields = [$item['MAIN_PHONE'] ?? '', $item['PHONE'] ?? ''];
        if (!empty($item['PHONES']) && is_array($item['PHONES'])) {
            foreach ($item['PHONES'] as $p) {
                $fields[] = is_array($p) ? ($p['PHONE'] ?? '') : $p;
            }
        }

        foreach ($fields as $val) {
            if (!empty($val) && strpos(preg_replace('/\D/', '', (string)$val), $phone10) !== false) {
                return true;
            }
        }

        return false;
    }

    private function formatContractor($contractor, $inn) {
        $id = (int)($contractor['CONTRACTOR_ID'] ?? $contractor['ID'] ?? 0);
        $title = $contractor['NAME'] ?? $contractor['TITLE'] ?? ("Организация ИНН " . $inn);

        return [
            'id' => $id,
            'CONTACT_ID' => $id,
            'title' => $title,
            'name' => $title,
            'type' => 'legal',
            'inn' => $inn,
            'phone' => $contractor['PHONE'] ?? ''
        ];
    }

    private function formatContact($contact, $type, $inn = '') {
        $id = (int)($contact['CONTACT_ID'] ?? $contact['ID'] ?? 0);
        $title = $contact['TITLE'] ?? '';

        if (empty($title)) {
            $fio = trim(($contact['SURNAME'] ?? '') . ' ' . ($contact['FIRSTNAME'] ?? '') . ' ' . ($contact['MIDDLENAME'] ?? ''));
            $title = !empty($fio) ? $fio : ($type === 'legal' ? "Организация (ID: {$id})" : "Клиент (ID: {$id})");
        }

        return [
            'id' => $id,
            'CONTACT_ID' => $id,
            'title' => $title,
            'name' => $title,
            'type' => $type,
            'inn' => $inn,
            'phone' => $contact['MAIN_PHONE'] ?? ($contact['PHONE'] ?? '')
        ];
    }

    private function log($msg) {
        file_put_contents(__DIR__ . '/../stocrm_debug.log', date('Y-m-d H:i:s') . " - [CustomerService] {$msg}\n", FILE_APPEND);
    }
}