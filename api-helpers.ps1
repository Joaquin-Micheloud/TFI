function Api($method, $path, $data) {
    $headers = @{}
    if ($token) { $headers.Authorization = "Bearer $token" }
    $p = @{ Uri = "http://localhost:3000$path"; Method = $method; Headers = $headers }
    if ($data) {
        $json = $data | ConvertTo-Json -Depth 10 -Compress
        $p.ContentType = "application/json; charset=utf-8"
        $p.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    ConvertTo-Json -InputObject (Invoke-RestMethod @p) -Depth 10
}

function Login($email) {
    (Invoke-RestMethod -Uri http://localhost:3000/auth/login -Method Post -ContentType "application/json" -Body (@{ email = $email; password = "secreto123" } | ConvertTo-Json)).accessToken
}

function UltimoToken {
    $id = (Invoke-RestMethod http://localhost:8025/api/v1/messages).messages[0].ID
    $texto = (Invoke-RestMethod "http://localhost:8025/api/v1/message/$id").Text
    [regex]::Match($texto, 'token=([a-f0-9]{64})').Groups[1].Value
}

$casaCentral   = "03f2a8f9-75d9-480f-8c78-467c2e092723"
$sucursalNorte = "a7526688-5606-487b-9897-1bd3dd594cbe"