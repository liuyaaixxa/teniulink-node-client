import DefaultAvatar from '@renderer/assets/images/avatar.png'
import EmojiAvatar from '@renderer/components/Avatar/EmojiAvatar'
import useAvatar from '@renderer/hooks/useAvatar'
import { useSettings } from '@renderer/hooks/useSettings'
import ImageStorage from '@renderer/services/ImageStorage'
import { useAppDispatch } from '@renderer/store'
import { setAvatar } from '@renderer/store/runtime'
import { setAuthLogout, setUserName } from '@renderer/store/settings'
import { compressImage, isEmoji } from '@renderer/utils'
import { Avatar, Button, Dropdown, Input, Modal, Popover, Upload } from 'antd'
import { LogOut } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import EmojiPicker from '../EmojiPicker'
import { Center, HStack, VStack } from '../Layout'
import { TopView } from '../TopView'

interface Props {
  resolve: (data: any) => void
}

const PopupContainer: React.FC<Props> = ({ resolve }) => {
  const [open, setOpen] = useState(true)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { t } = useTranslation()
  const { userName, auth } = useSettings()
  const dispatch = useAppDispatch()
  const avatar = useAvatar()

  const onOk = () => {
    setOpen(false)
  }

  const onCancel = () => {
    setOpen(false)
  }

  const onClose = () => {
    resolve({})
  }

  const handleLogout = () => {
    dispatch(setAuthLogout())
    setOpen(false)
  }

  const handleEmojiClick = async (emoji: string) => {
    try {
      // set emoji string
      await ImageStorage.set('avatar', emoji)
      // update avatar display
      dispatch(setAvatar(emoji))
      setEmojiPickerOpen(false)
    } catch (error: any) {
      window.toast.error(error.message)
    }
  }
  const handleReset = async () => {
    try {
      await ImageStorage.set('avatar', DefaultAvatar)
      dispatch(setAvatar(DefaultAvatar))
      setDropdownOpen(false)
    } catch (error: any) {
      window.toast.error(error.message)
    }
  }
  const items = [
    {
      key: 'upload',
      label: (
        <div style={{ width: '100%', textAlign: 'center' }}>
          <Upload
            customRequest={() => {}}
            accept="image/png, image/jpeg, image/gif"
            itemRender={() => null}
            maxCount={1}
            onChange={async ({ file }) => {
              try {
                const _file = file.originFileObj as File
                if (_file.type === 'image/gif') {
                  await ImageStorage.set('avatar', _file)
                } else {
                  const compressedFile = await compressImage(_file)
                  await ImageStorage.set('avatar', compressedFile)
                }
                dispatch(setAvatar(await ImageStorage.get('avatar')))
                setDropdownOpen(false)
              } catch (error: any) {
                window.toast.error(error.message)
              }
            }}>
            {t('settings.general.image_upload')}
          </Upload>
        </div>
      )
    },
    {
      key: 'emoji',
      label: (
        <div
          style={{ width: '100%', textAlign: 'center' }}
          onClick={(e) => {
            e.stopPropagation()
            setEmojiPickerOpen(true)
            setDropdownOpen(false)
          }}>
          {t('settings.general.emoji_picker')}
        </div>
      )
    },
    {
      key: 'reset',
      label: (
        <div
          style={{ width: '100%', textAlign: 'center' }}
          onClick={(e) => {
            e.stopPropagation()
            void handleReset()
          }}>
          {t('settings.general.avatar.reset')}
        </div>
      )
    }
  ]

  const loginTimeFormatted = auth?.loginTime
    ? new Date(auth.loginTime).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''

  return (
    <Modal
      width="300px"
      open={open}
      footer={null}
      onOk={onOk}
      onCancel={onCancel}
      afterClose={onClose}
      transitionName="animation-move-down"
      centered>
      <Center mt="30px">
        <VStack alignItems="center" gap="10px">
          <Dropdown
            menu={{ items }}
            trigger={['click']}
            open={dropdownOpen}
            align={{ offset: [0, 4] }}
            placement="bottom"
            onOpenChange={(visible) => {
              setDropdownOpen(visible)
              if (visible) {
                setEmojiPickerOpen(false)
              }
            }}>
            <Popover
              content={<EmojiPicker onEmojiClick={handleEmojiClick} />}
              trigger="click"
              open={emojiPickerOpen}
              onOpenChange={(visible) => {
                setEmojiPickerOpen(visible)
                if (visible) {
                  setDropdownOpen(false)
                }
              }}
              placement="bottom">
              {isEmoji(avatar) ? (
                <EmojiAvatar size={80} fontSize={40}>
                  {avatar}
                </EmojiAvatar>
              ) : (
                <UserAvatar src={avatar} />
              )}
            </Popover>
          </Dropdown>
        </VStack>
      </Center>
      <HStack alignItems="center" gap="10px" p="20px">
        <Input
          placeholder={t('settings.general.user_name.placeholder')}
          value={userName}
          onChange={(e) => dispatch(setUserName(e.target.value.trim()))}
          style={{ flex: 1, textAlign: 'center', width: '100%' }}
          maxLength={30}
        />
      </HStack>
      {auth?.isLoggedIn && (
        <AuthInfoSection>
          <AuthInfoRow>
            <AuthLabel>{t('settings.general.user_name.placeholder')}:</AuthLabel>
            <AuthValue>{auth.username}</AuthValue>
          </AuthInfoRow>
          {loginTimeFormatted && (
            <AuthInfoRow>
              <AuthLabel>Login:</AuthLabel>
              <AuthValue>{loginTimeFormatted}</AuthValue>
            </AuthInfoRow>
          )}
          <LogoutButton type="text" danger icon={<LogOut size={14} />} onClick={handleLogout} block>
            Logout
          </LogoutButton>
        </AuthInfoSection>
      )}
    </Modal>
  )
}

const UserAvatar = styled(Avatar)`
  cursor: pointer;
  width: 80px;
  height: 80px;
  transition: opacity 0.3s ease;
  &:hover {
    opacity: 0.8;
  }
`

const AuthInfoSection = styled.div`
  padding: 0 20px 16px;
  border-top: 1px solid var(--color-border);
  margin-top: 4px;
  padding-top: 12px;
`

const AuthInfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
`

const AuthLabel = styled.span`
  color: var(--color-text-3);
`

const AuthValue = styled.span`
  color: var(--color-text-1);
  font-weight: 500;
`

const LogoutButton = styled(Button)`
  margin-top: 8px;
  font-size: 13px;
`

export default class UserPopup {
  static topviewId = 0
  static hide() {
    TopView.hide('UserPopup')
  }
  static show() {
    return new Promise<any>((resolve) => {
      TopView.show(
        <PopupContainer
          resolve={(v) => {
            resolve(v)
            this.hide()
          }}
        />,
        'UserPopup'
      )
    })
  }
}
